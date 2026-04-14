import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, X, Star, ExternalLink, Bookmark, Zap, Activity,
  AlertCircle, CheckCircle, Filter, RefreshCw, ChevronDown,
  ChevronUp, Github, Users, Tag, Clock, Eye, TrendingUp,
} from 'lucide-react';
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

function scoreBadgeClass(score) {
  if (score >= 75) return 'badge-success';
  if (score >= 50) return 'badge-warning';
  return 'badge-error';
}

function fmtStars(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2 mt-1">
      <progress
        className="progress w-full h-[7px]"
        value={score}
        max="100"
        style={{ accentColor: color }}
      />
      <span className="text-xs font-bold min-w-[34px]" style={{ color }}>{score}%</span>
    </div>
  );
}

function RepoRow({ repo, selected, onToggle, onDetail }) {
  return (
    <div
      className="border border-base-300 rounded-lg p-3 mb-2 flex items-start gap-3 cursor-pointer hover:border-primary transition-colors"
      onClick={onDetail}
    >
      <input
        type="checkbox"
        className="checkbox checkbox-sm mt-0.5 flex-shrink-0"
        checked={selected}
        onChange={onToggle}
        onClick={e => e.stopPropagation()}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
          <Github size={14} className="text-base-content/60 flex-shrink-0" />
          <span className="text-sm font-bold truncate">{repo.fullName}</span>
          <span className="badge badge-sm badge-ghost">{repo.language}</span>
          <span className="badge badge-sm badge-outline gap-1">
            <Star size={10} />{fmtStars(repo.stars)}
          </span>
          <span className="text-xs text-base-content/50">{repo.sizeMb} MB</span>
        </div>
        <p className="text-xs text-base-content/60 truncate mb-1">{repo.description || 'No description'}</p>
        <ScoreBar score={repo.smartScore} />
      </div>
      <button
        className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
        title="View details"
        onClick={e => { e.stopPropagation(); onDetail(); }}
      >
        <Eye size={14} />
      </button>
    </div>
  );
}

function IssueRow({ issue, selected, onToggle }) {
  return (
    <div className="border border-base-300 rounded-lg p-3 mb-2 flex items-start gap-3">
      <input
        type="checkbox"
        className="checkbox checkbox-sm mt-0.5 flex-shrink-0"
        checked={selected}
        onChange={onToggle}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <AlertCircle size={13} className="text-error flex-shrink-0" />
          <span className="text-sm font-semibold truncate flex-1">{issue.issueTitle}</span>
        </div>
        <p className="text-xs text-base-content/60 mb-1">{issue.repoName}</p>
        <div className="flex gap-1.5 flex-wrap">
          <span className="badge badge-sm badge-primary badge-outline">{issue.meaningfulLines}+ lines</span>
          {issue.hasTests && <span className="badge badge-sm badge-success badge-outline">has tests</span>}
          <span className="badge badge-sm badge-ghost">{issue.repoCategory}</span>
          <span className="badge badge-sm badge-outline font-mono">SHA: {issue.baseSha?.slice(0, 7)}</span>
        </div>
      </div>
      <a
        href={issue.issueLink}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-xs btn-circle flex-shrink-0"
        title="Open issue on GitHub"
        onClick={e => e.stopPropagation()}
      >
        <ExternalLink size={13} />
      </a>
    </div>
  );
}

function RepoDetailDialog({ repo, open, onClose, onSave }) {
  if (!repo || !open) return null;
  const checks = [
    { label: 'Test suite',       ok: repo.checks?.hasTests },
    { label: 'README file',      ok: repo.checks?.hasReadme },
    { label: 'Package manager',  ok: repo.checks?.hasPkg },
    { label: 'CI/CD pipeline',   ok: repo.checks?.hasCi },
    { label: 'Linter config',    ok: repo.checks?.hasLinter },
    { label: 'Formatter config', ok: repo.checks?.hasFormatter },
  ];
  return (
    <dialog className="modal modal-open" style={{ zIndex: 1100 }}>
      <div className="modal-box w-11/12 max-w-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Github size={18} className="flex-shrink-0" />
          <h3 className="font-bold text-base truncate flex-1">{repo.fullName}</h3>
          <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={16} /></button>
        </div>

        <p className="text-sm text-base-content/60 mb-3">{repo.description || 'No description'}</p>

        <div className="flex gap-1.5 flex-wrap mb-4">
          <span className="badge badge-sm badge-ghost">{repo.language}</span>
          <span className="badge badge-sm badge-outline gap-1"><Star size={10} />{repo.stars?.toLocaleString()} stars</span>
          <span className="badge badge-sm badge-ghost">{repo.sizeMb} MB</span>
          <span className="badge badge-sm badge-outline">Updated {new Date(repo.updatedAt).toLocaleDateString()}</span>
        </div>

        <p className="text-xs font-semibold mb-1">Smartness Score</p>
        <div className="mb-4"><ScoreBar score={repo.smartScore} /></div>

        <p className="text-xs font-semibold mb-2">Checks</p>
        <ul className="space-y-1 mb-4">
          {checks.map(({ label, ok }) => (
            <li key={label} className="flex items-center gap-2 text-sm">
              {ok
                ? <CheckCircle size={15} className="text-success flex-shrink-0" />
                : <X size={15} className="text-error flex-shrink-0" />}
              {label}
            </li>
          ))}
        </ul>

        <div className="modal-action">
          <a
            href={repo.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm gap-1"
          >
            <ExternalLink size={14} /> View on GitHub
          </a>
          <button
            className="btn btn-primary btn-sm gap-1"
            onClick={() => { onSave(repo); onClose(); }}
          >
            <Bookmark size={14} /> Save to My Repos
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button>close</button>
      </form>
    </dialog>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function SmartSearchModal({ open, onClose, onImported, initialTab = 0 }) {
  const { user } = useAuth();
  const rs = useRandomSearch();
  const [tab, setTab] = useState(initialTab);

  // Jump to the initialTab whenever it changes (e.g. opened from tray navigate button)
  useEffect(() => { setTab(initialTab); }, [initialTab]);

  // GitHub tokens are now managed server-side via the token pool.
  // The client no longer needs to pass a token with each request.

  // Repo search
  const [language, setLanguage]           = useState('Python');
  const [keyword, setKeyword]             = useState('');
  const [repoResults, setRepoResults]     = useState([]);
  const [repoLoading, setRepoLoading]     = useState(false);
  const [selectedRepos, setSelectedRepos] = useState(new Set());
  const [detailRepo, setDetailRepo]       = useState(null);

  // Saved repos
  const [savedRepos, setSavedRepos] = useState([]);

  // Issue search
  const [issueMode, setIssueMode]           = useState(0); // 0=url, 1=saved repos
  const [issueUrl, setIssueUrl]             = useState('');
  const [issueResults, setIssueResults]     = useState([]);
  const [issueLoading, setIssueLoading]     = useState(false);
  const [selectedIssues, setSelectedIssues] = useState(new Set());
  const [selectedSaved, setSelectedSaved]   = useState(new Set());

  // Status
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [importing, setImporting] = useState(false);

  // Score filters — loaded from user account settings (Profile → Smart Search Filters)
  const minRepoScore  = user?.minRepoScore  ?? 0;
  const minIssueScore = user?.minIssueScore ?? 0;

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
      const res = await searchRepos({ keyword: keyword.trim(), language });
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
    if (selectedRepos.size === filteredRepoResults.length) setSelectedRepos(new Set());
    else setSelectedRepos(new Set(filteredRepoResults.map(r => r.fullName)));
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
      const res = await validateUrl({ url: issueUrl.trim() });
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
    if (selectedIssues.size === filteredIssueResults.length) setSelectedIssues(new Set());
    else setSelectedIssues(new Set(filteredIssueResults.map(i => i.issueLink)));
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

  if (!open) return null;

  const selectedRepoList = repoResults.filter(r => selectedRepos.has(r.fullName));
  const isIssueUrl = /\/issues\/\d+/.test(issueUrl);

  // Filtered results respecting score thresholds
  const filteredRepoResults  = minRepoScore  > 0 ? repoResults.filter(r => r.smartScore  >= minRepoScore)  : repoResults;
  const filteredIssueResults = minIssueScore > 0 ? issueResults.filter(i => (i.issueScore ?? 0) >= minIssueScore) : issueResults;
  const filteredQueue        = minIssueScore > 0 ? rs.queue.filter(item => item.score >= minIssueScore)    : rs.queue;
  const hiddenRepoCount  = repoResults.length  - filteredRepoResults.length;
  const hiddenIssueCount = issueResults.length - filteredIssueResults.length;
  const hiddenQueueCount = rs.queue.length      - filteredQueue.length;

  const hasActiveFilters = minRepoScore > 0 || minIssueScore > 0;

  const TABS = [
    { label: 'Repo Search',               icon: <Search size={15} /> },
    { label: 'Issue Search',              icon: <Activity size={15} /> },
    { label: `My Repos (${savedRepos.length})`, icon: <Github size={15} /> },
    { label: 'Random Search',             icon: <Zap size={15} /> },
  ];

  return (
    <>
      <dialog className="modal modal-open" style={{ zIndex: 1000 }}>
        <div className="modal-box w-11/12 max-w-5xl flex flex-col p-0 overflow-hidden" style={{ maxHeight: '90vh', height: '90vh' }}>

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-base-300 flex-shrink-0">
            <Zap size={18} className="text-primary flex-shrink-0" />
            <span className="font-bold text-base flex-1">Smart Issue Search</span>

            {!(user?.githubTokens?.length || user?.githubToken) && (
              <span
                className="badge badge-sm badge-warning badge-outline"
                title="Add GitHub tokens in Profile → GitHub Tokens to increase rate limits from 60 to 5000 req/hr"
              >
                No GitHub token set
              </span>
            )}
            {user?.githubTokens?.length > 0 && (
              <span
                className="badge badge-sm badge-success badge-outline"
                title={`${user.githubTokens.length} GitHub token(s) configured — server rotates automatically`}
              >
                {user.githubTokens.length} token{user.githubTokens.length > 1 ? 's' : ''}
              </span>
            )}
            {hasActiveFilters && (
              <span
                className="badge badge-sm badge-primary badge-outline gap-1"
                title={`Score filters active: Repo ≥ ${minRepoScore || 'off'}, Issue ≥ ${minIssueScore || 'off'} — change in Profile → Smart Search Filters`}
              >
                <Filter size={10} />
                {[minRepoScore > 0 && `Repo ≥ ${minRepoScore}`, minIssueScore > 0 && `Issue ≥ ${minIssueScore}`].filter(Boolean).join(' · ')}
              </span>
            )}
            <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}><X size={16} /></button>
          </div>

          {/* ── Tabs ────────────────────────────────────────────────────── */}
          <div role="tablist" className="tabs tabs-bordered flex-shrink-0 px-2">
            {TABS.map((t, i) => (
              <button
                key={i}
                role="tab"
                className={`tab gap-1.5 text-sm${tab === i ? ' tab-active' : ''}`}
                onClick={() => setTab(i)}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* ── Content ─────────────────────────────────────────────────── */}
          <div className="flex flex-col flex-1 overflow-hidden px-4 py-3 gap-2">

            {/* Alerts */}
            {error && (
              <div role="alert" className="alert alert-error text-sm flex-shrink-0 whitespace-pre-wrap">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
                <button className="btn btn-ghost btn-xs btn-circle ml-auto" onClick={() => setError('')}><X size={14} /></button>
              </div>
            )}
            {successMsg && (
              <div role="alert" className="alert alert-success text-sm flex-shrink-0">
                <CheckCircle size={16} className="flex-shrink-0" />
                <span>{successMsg}</span>
                <button className="btn btn-ghost btn-xs btn-circle ml-auto" onClick={() => setSuccessMsg('')}><X size={14} /></button>
              </div>
            )}

            {/* ── Tab 0: Repo Search ──────────────────────────────────── */}
            {tab === 0 && (
              <div className="flex flex-col flex-1 overflow-hidden gap-2">
                {/* Search form */}
                <div className="flex gap-2 flex-shrink-0">
                  <select
                    className="select select-bordered select-sm w-36"
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                  >
                    {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
                    <Search size={14} className="opacity-50 flex-shrink-0" />
                    <input
                      type="text"
                      className="grow"
                      placeholder="e.g. data pipeline, web scraper, CLI tool, REST API..."
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRepoSearch()}
                    />
                  </label>
                  <button
                    className="btn btn-primary btn-sm gap-1 flex-shrink-0"
                    onClick={handleRepoSearch}
                    disabled={repoLoading || !keyword.trim()}
                  >
                    {repoLoading
                      ? <span className="loading loading-spinner loading-xs" />
                      : <Search size={14} />}
                    Search
                  </button>
                </div>

                {/* Results */}
                <div className="flex-1 overflow-y-auto pr-1">
                  {repoLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-lg" />
                    </div>
                  ) : repoResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-base-content/40 gap-2">
                      <Search size={48} className="opacity-20" />
                      <p className="text-base">Search GitHub repositories to get started</p>
                      <p className="text-sm text-center">
                        Repos are scored 0–100% based on test suite, CI/CD, documentation, and activity
                      </p>
                    </div>
                  ) : (
                    <>
                      {hiddenRepoCount > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 text-warning text-xs">
                          <Filter size={12} />
                          {hiddenRepoCount} repo{hiddenRepoCount !== 1 ? 's' : ''} hidden by score filter
                        </div>
                      )}
                      {filteredRepoResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-base-content/40 gap-1">
                          <Filter size={36} className="opacity-25" />
                          <p className="text-sm">All results filtered out</p>
                          <p className="text-xs">Lower the Min Repo Score threshold to see more results</p>
                        </div>
                      ) : (
                        filteredRepoResults.map(repo => (
                          <RepoRow
                            key={repo.fullName}
                            repo={repo}
                            selected={selectedRepos.has(repo.fullName)}
                            onToggle={() => toggleRepo(repo.fullName)}
                            onDetail={() => setDetailRepo(repo)}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>

                {/* Action bar */}
                {repoResults.length > 0 && (
                  <div className="flex items-center gap-3 pt-2 border-t border-base-300 flex-shrink-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={filteredRepoResults.length > 0 && selectedRepos.size === filteredRepoResults.length}
                      ref={el => {
                        if (el) el.indeterminate = selectedRepos.size > 0 && selectedRepos.size < filteredRepoResults.length;
                      }}
                      onChange={toggleAllRepos}
                      disabled={filteredRepoResults.length === 0}
                    />
                    <span className="text-sm text-base-content/60">
                      {selectedRepos.size} of {filteredRepoResults.length} shown
                      {hiddenRepoCount > 0 && (
                        <span className="text-warning text-xs ml-1.5">({hiddenRepoCount} filtered)</span>
                      )}
                    </span>
                    <div className="flex-1" />
                    <button
                      className="btn btn-ghost btn-sm gap-1"
                      onClick={() => handleSaveRepos()}
                      disabled={!selectedRepos.size}
                    >
                      <Bookmark size={14} /> Save to My Repos
                    </button>
                    <button
                      className="btn btn-primary btn-sm gap-1"
                      onClick={handleFindIssuesFromSearch}
                      disabled={!selectedRepos.size || issueLoading}
                    >
                      {issueLoading
                        ? <span className="loading loading-spinner loading-xs" />
                        : <Activity size={14} />}
                      Find Issues →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 1: Issue Search ─────────────────────────────────── */}
            {tab === 1 && (
              <div className="flex flex-col flex-1 overflow-hidden gap-2">
                {/* Sub-tabs */}
                <div role="tablist" className="tabs tabs-bordered flex-shrink-0">
                  <button
                    role="tab"
                    className={`tab text-sm${issueMode === 0 ? ' tab-active' : ''}`}
                    onClick={() => setIssueMode(0)}
                  >
                    By URL
                  </button>
                  <button
                    role="tab"
                    className={`tab text-sm${issueMode === 1 ? ' tab-active' : ''}`}
                    onClick={() => setIssueMode(1)}
                  >
                    From My Repos ({savedRepos.length})
                  </button>
                </div>

                {/* By URL */}
                {issueMode === 0 && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <div className="flex gap-2">
                      <label className="input input-bordered input-sm flex items-center gap-2 flex-1">
                        <Search size={14} className="opacity-50 flex-shrink-0" />
                        <input
                          type="text"
                          className="grow"
                          placeholder="github.com/owner/repo  or  github.com/owner/repo/issues/123"
                          value={issueUrl}
                          onChange={e => setIssueUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleValidateUrl()}
                        />
                      </label>
                      <button
                        className="btn btn-primary btn-sm gap-1 flex-shrink-0 self-start"
                        onClick={handleValidateUrl}
                        disabled={issueLoading || !issueUrl.trim()}
                      >
                        {issueLoading
                          ? <span className="loading loading-spinner loading-xs" />
                          : <Search size={14} />}
                        {isIssueUrl ? 'Validate' : 'Search'}
                      </button>
                    </div>
                    <p className="text-xs text-base-content/50">
                      Paste a repo URL to find all valid issues, or a specific issue URL to validate it
                    </p>
                  </div>
                )}

                {/* From saved repos */}
                {issueMode === 1 && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {savedRepos.length === 0 ? (
                      <div role="alert" className="alert alert-info text-sm">
                        <AlertCircle size={16} />
                        <span>No saved repos yet — use Repo Search to find and save repos first.</span>
                      </div>
                    ) : (
                      <div className="border border-base-300 rounded-lg overflow-y-auto" style={{ maxHeight: 180 }}>
                        {savedRepos.map(repo => (
                          <div key={repo.id} className="flex items-center gap-2 py-1.5 px-3 hover:bg-base-200 border-b border-base-200 last:border-0">
                            <input
                              type="checkbox"
                              className="checkbox checkbox-sm"
                              checked={selectedSaved.has(repo.id)}
                              onChange={() => toggleSaved(repo.id)}
                            />
                            <span className="text-sm flex-1 truncate">{repo.fullName}</span>
                            <span className="badge badge-sm badge-ghost">{repo.language}</span>
                            <span className={`badge badge-sm ${scoreBadgeClass(repo.smartScore)}`}>{repo.smartScore}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      className="btn btn-primary btn-sm gap-1 self-start"
                      onClick={handleFindIssuesFromSaved}
                      disabled={!selectedSaved.size || issueLoading}
                    >
                      {issueLoading
                        ? <span className="loading loading-spinner loading-xs" />
                        : <Search size={14} />}
                      Search Issues in {selectedSaved.size} Repo{selectedSaved.size !== 1 ? 's' : ''}
                    </button>
                  </div>
                )}

                {/* Issue results */}
                <div className="flex-1 overflow-y-auto pr-1">
                  {issueLoading ? (
                    <div className="flex justify-center py-8">
                      <span className="loading loading-spinner loading-lg" />
                    </div>
                  ) : issueResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-base-content/40 gap-2">
                      <AlertCircle size={48} className="opacity-20" />
                      <p className="text-base">No results yet</p>
                      <p className="text-sm text-center">
                        Issues are validated against complexity, linked PR, and meaningful line changes (&gt;20)
                      </p>
                    </div>
                  ) : (
                    <>
                      {hiddenIssueCount > 0 && (
                        <div className="flex items-center gap-1.5 mb-2 text-warning text-xs">
                          <Filter size={12} />
                          {hiddenIssueCount} issue{hiddenIssueCount !== 1 ? 's' : ''} hidden by score filter
                        </div>
                      )}
                      {filteredIssueResults.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-base-content/40 gap-1">
                          <Filter size={36} className="opacity-25" />
                          <p className="text-sm">All results filtered out</p>
                          <p className="text-xs">Lower the Min Issue Score threshold to see more results</p>
                        </div>
                      ) : (
                        filteredIssueResults.map(issue => (
                          <IssueRow
                            key={issue.issueLink}
                            issue={issue}
                            selected={selectedIssues.has(issue.issueLink)}
                            onToggle={() => toggleIssue(issue.issueLink)}
                          />
                        ))
                      )}
                    </>
                  )}
                </div>

                {/* Import action bar */}
                {issueResults.length > 0 && (
                  <div className="flex items-center gap-3 pt-2 border-t border-base-300 flex-shrink-0">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={filteredIssueResults.length > 0 && selectedIssues.size === filteredIssueResults.length}
                      ref={el => {
                        if (el) el.indeterminate = selectedIssues.size > 0 && selectedIssues.size < filteredIssueResults.length;
                      }}
                      onChange={toggleAllIssues}
                      disabled={filteredIssueResults.length === 0}
                    />
                    <span className="text-sm text-base-content/60">
                      {selectedIssues.size} of {filteredIssueResults.length} shown
                      {hiddenIssueCount > 0 && (
                        <span className="text-warning text-xs ml-1.5">({hiddenIssueCount} filtered)</span>
                      )}
                    </span>
                    <div className="flex-1" />
                    <div className="flex flex-col items-end gap-1">
                      {importing && (
                        <span className="text-xs text-base-content/50">Fetching GitHub data &amp; scoring…</span>
                      )}
                      <button
                        className="btn btn-success btn-sm gap-1"
                        onClick={handleImportIssues}
                        disabled={!selectedIssues.size || importing}
                      >
                        {importing
                          ? <span className="loading loading-spinner loading-xs" />
                          : <TrendingUp size={14} />}
                        {importing ? 'Importing…' : `Import ${selectedIssues.size} Issue${selectedIssues.size !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 2: My Repos ─────────────────────────────────────── */}
            {tab === 2 && (
              <div className="flex flex-col flex-1 overflow-hidden gap-2">
                {savedRepos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-base-content/40 gap-2">
                    <Github size={48} className="opacity-20" />
                    <p>No saved repos yet</p>
                    <p className="text-sm">Use Repo Search to find repos and save them here</p>
                    <button className="btn btn-outline btn-sm mt-2" onClick={() => setTab(0)}>
                      Go to Repo Search
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto pr-1">
                      {savedRepos.map(repo => (
                        <div
                          key={repo.id}
                          className="border border-base-300 rounded-lg p-3 mb-2 flex items-center gap-3"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm flex-shrink-0"
                            checked={selectedSaved.has(repo.id)}
                            onChange={() => toggleSaved(repo.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                              <span className="text-sm font-semibold truncate">{repo.fullName}</span>
                              <span className="badge badge-sm badge-ghost">{repo.language}</span>
                              <span className="badge badge-sm badge-outline gap-1">
                                <Star size={10} />{fmtStars(repo.stars)}
                              </span>
                            </div>
                            <p className="text-xs text-base-content/60 truncate">{repo.description || 'No description'}</p>
                            <ScoreBar score={repo.smartScore} />
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <a
                              href={repo.htmlUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-ghost btn-xs btn-circle"
                              title="View on GitHub"
                            >
                              <ExternalLink size={13} />
                            </a>
                            <button
                              className="btn btn-ghost btn-xs btn-circle text-error"
                              title="Remove from My Repos"
                              onClick={() => handleDeleteSaved(repo.id)}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action bar */}
                    <div className="flex items-center gap-3 pt-2 border-t border-base-300 flex-shrink-0">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedSaved.size === savedRepos.length && savedRepos.length > 0}
                        ref={el => {
                          if (el) el.indeterminate = selectedSaved.size > 0 && selectedSaved.size < savedRepos.length;
                        }}
                        onChange={() => {
                          if (selectedSaved.size === savedRepos.length) setSelectedSaved(new Set());
                          else setSelectedSaved(new Set(savedRepos.map(r => r.id)));
                        }}
                      />
                      <span className="text-sm text-base-content/60">{selectedSaved.size} of {savedRepos.length} selected</span>
                      <div className="flex-1" />
                      <button
                        className="btn btn-primary btn-sm gap-1"
                        onClick={async () => {
                          await handleFindIssuesFromSaved();
                          setTab(1);
                          setIssueMode(1);
                        }}
                        disabled={!selectedSaved.size || issueLoading}
                      >
                        {issueLoading
                          ? <span className="loading loading-spinner loading-xs" />
                          : <Activity size={14} />}
                        Find Issues in {selectedSaved.size} Repo{selectedSaved.size !== 1 ? 's' : ''}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Tab 3: Random Search ───────────────────────────────── */}
            {tab === 3 && (
              <div className="flex flex-col flex-1 overflow-hidden gap-3">

                {/* ── Top controls bar: 80% width, left-aligned ── */}
                <div className="flex flex-col gap-2 flex-shrink-0" style={{ width: '80%' }}>
                  {/* Controls row */}
                  <div className="flex gap-2 flex-wrap items-center">
                    {rs.running ? (
                      <button className="btn btn-error btn-sm" onClick={rs.stopSearch}>
                        ■ Stop
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm gap-1" onClick={rs.startSearch}>
                        <Zap size={14} />
                        {rs.log.length > 0 || rs.imported > 0 || rs.queue.length > 0
                          ? 'Continue Search'
                          : 'Start Random Search'}
                      </button>
                    )}
                    <button
                      className="btn btn-outline btn-warning btn-sm gap-1"
                      disabled={rs.running}
                      onClick={rs.clearAll}
                      title="Clear search log and all pending queue items"
                    >
                      <RefreshCw size={13} /> Clear Log
                    </button>
                    {rs.imported > 0 && (
                      <span className="badge badge-success font-bold">{rs.imported} imported</span>
                    )}
                    {rs.queue.length > 0 && !rs.autoApprove && (
                      <span className="badge badge-warning font-bold">{rs.queue.length} pending review</span>
                    )}
                    {rs.running && (
                      <span className="text-xs text-base-content/50 self-center">
                        Runs in background — use the tray widget to monitor.
                      </span>
                    )}
                  </div>

                  {/* Keyword category selector */}
                  <div>
                    <div className="flex gap-2 items-center mb-1">
                      <button
                        className={`btn btn-xs ${rs.showCategories ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => rs.setShowCategories(v => !v)}
                      >
                        {rs.showCategories ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {rs.showCategories ? 'Hide' : 'Keyword Categories'}
                      </button>
                      {rs.showCategories && (
                        <>
                          <button className="btn btn-ghost btn-xs" onClick={() => rs.setSelectedCategories(new Set(Object.keys(WORD_CATEGORIES)))}>
                            Select All
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => rs.setSelectedCategories(new Set())}>
                            Select None
                          </button>
                        </>
                      )}
                      <span className="text-xs text-base-content/50">
                        {rs.selectedCategories.size === 0
                          ? `All categories · ${Object.values(WORD_CATEGORIES).flat().length} words`
                          : `${rs.selectedCategories.size} categor${rs.selectedCategories.size === 1 ? 'y' : 'ies'} · ${getActivePool(rs.selectedCategories).length} words`}
                      </span>
                    </div>
                    {rs.showCategories && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.keys(WORD_CATEGORIES).map(cat => {
                          const isSel = rs.selectedCategories.has(cat);
                          const active = rs.selectedCategories.size === 0 || isSel;
                          return (
                            <button
                              key={cat}
                              className={`badge badge-sm cursor-pointer select-none transition-opacity ${isSel ? 'badge-primary' : 'badge-outline'} ${active ? 'opacity-100' : 'opacity-50'}`}
                              onClick={() => {
                                if (rs.running) return;
                                rs.setSelectedCategories(prev => {
                                  const n = new Set(prev);
                                  n.has(cat) ? n.delete(cat) : n.add(cat);
                                  return n;
                                });
                              }}
                            >
                              {cat} ({WORD_CATEGORIES[cat].length})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Bottom: 50/50 Terminal | Review Panel ── */}
                <div className="flex flex-row flex-1 gap-4 overflow-hidden min-h-0">

                  {/* ── Left 50%: Terminal ── */}
                  <div className="w-1/2 flex flex-col overflow-hidden min-w-0">
                    <div className="flex-1 flex flex-col border border-[#d1d1d6] rounded-lg shadow-sm overflow-hidden mb-2">
                      {/* macOS title bar */}
                      <div className="flex items-center gap-1.5 bg-[#ececec] px-3 py-1.5 border-b border-[#d1d1d6] flex-shrink-0 rounded-t-lg">
                        <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-black/10" />
                        <div className="w-3 h-3 rounded-full bg-[#febc2e] border border-black/10" />
                        <div className="w-3 h-3 rounded-full bg-[#28c840] border border-black/10" />
                        <span className="flex-1 text-center text-[11px] text-[#555] font-medium tracking-wide">
                          Random Search — Terminal
                        </span>
                        {rs.running && <span className="loading loading-spinner loading-xs" />}
                      </div>
                      {/* Log body */}
                      <div
                        className="flex-1 overflow-y-auto bg-white p-3 rounded-b-lg"
                        style={{ fontFamily: '"SF Mono", "Menlo", "Monaco", "Consolas", monospace', fontSize: 12, color: '#1d1d1f' }}
                      >
                        {rs.log.length === 0 ? (
                          <span style={{ color: '#aeaeb2' }}>
                            Press "Start" to continuously search repos for issues using random English words.
                            Found issues will appear in the Review Panel on the right.
                          </span>
                        ) : (
                          rs.log.map((entry, i) => (
                            <div
                              key={i}
                              style={{
                                color: entry.color === 'inherit' ? '#1d1d1f' : entry.color,
                                whiteSpace: 'pre-wrap',
                                lineHeight: 1.7,
                              }}
                            >
                              {entry.text}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Right 50%: Review Panel ── */}
                  <div className="w-1/2 flex flex-col border border-base-300 rounded-xl overflow-hidden min-w-0 mb-2">
                    {/* Panel header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-base-200 border-b border-base-300 flex-shrink-0">
                      <Eye size={15} className="text-primary flex-shrink-0" />
                      <span className="text-sm font-bold flex-1">
                        Review Panel
                        {filteredQueue.length > 0 && (
                          <span className="badge badge-sm badge-warning ml-2">{filteredQueue.length}</span>
                        )}
                      </span>
                      {/* Auto-approve toggle */}
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <span className="text-xs">Auto</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-success toggle-xs"
                          checked={rs.autoApprove}
                          onChange={e => rs.setAutoApprove(e.target.checked)}
                          disabled={rs.running}
                        />
                      </label>
                      {filteredQueue.length > 0 && (
                        <>
                          <button className="btn btn-success btn-xs" onClick={rs.handleApproveAll}>
                            Approve All
                          </button>
                          <button
                            className="btn btn-error btn-outline btn-xs"
                            title="Reject all pending"
                            onClick={rs.handleRejectAll}
                          >
                            Reject all
                          </button>
                        </>
                      )}
                    </div>

                    {/* Panel body */}
                    {rs.queue.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 text-base-content/40 gap-2">
                        <Eye size={40} className="opacity-25" />
                        <p className="text-sm text-center text-base-content/60">
                          {rs.autoApprove ? 'Auto-approve is ON — issues are imported automatically.' : 'No issues waiting for review.'}
                        </p>
                        <p className="text-xs text-center text-base-content/30">
                          Start the search — found issues will appear here for your approval before being imported.
                        </p>
                      </div>
                    ) : filteredQueue.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-1">
                        <Filter size={36} className="opacity-25 text-warning" />
                        <p className="text-sm text-center text-base-content/60">
                          {hiddenQueueCount} issue{hiddenQueueCount !== 1 ? 's' : ''} hidden by score filter
                        </p>
                        <p className="text-xs text-center text-base-content/30">
                          Lower the Min Issue Score threshold to see pending issues
                        </p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
                        {hiddenQueueCount > 0 && (
                          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-yellow-50 rounded-lg border border-yellow-200 text-xs text-yellow-700">
                            <Filter size={11} className="flex-shrink-0" />
                            {hiddenQueueCount} issue{hiddenQueueCount !== 1 ? 's' : ''} hidden by score filter
                          </div>
                        )}
                        {filteredQueue.map(item => {
                          const scoreClass = item.score >= 75 ? 'border-success/40 bg-success/5'
                            : item.score >= 50 ? 'border-warning/40 bg-warning/5'
                            : 'border-error/40 bg-error/5';
                          return (
                            <div
                              key={item.uid}
                              className={`border rounded-xl p-3 flex-shrink-0 ${scoreClass}`}
                            >
                              {/* Issue title */}
                              <p
                                className="text-sm font-semibold mb-1.5 truncate"
                                title={item.issue.issueTitle}
                              >
                                {item.issue.issueTitle || '(no title)'}
                              </p>

                              {/* Meta row */}
                              <div className="flex gap-1.5 flex-wrap items-center mb-2">
                                <span className={`badge badge-sm font-bold ${scoreBadgeClass(item.score)}`}>
                                  Score: {item.score}
                                </span>
                                {item.issue.repoCategory && (
                                  <span className="badge badge-sm badge-outline">{item.issue.repoCategory}</span>
                                )}
                                <span className="text-xs text-base-content/50 truncate max-w-[140px]">
                                  {item.issue.repoName}
                                </span>
                              </div>

                              {/* Score breakdown + action buttons */}
                              <div className="flex items-center gap-2">
                                <div className="relative group flex-1">
                                  <span className="text-xs text-base-content/30 cursor-default">Breakdown ▸</span>
                                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 bg-base-300 text-xs rounded-lg p-2 shadow-lg whitespace-nowrap">
                                    {Object.entries(item.breakdown).map(([k, v]) => (
                                      <div key={k}>{k}: +{v}</div>
                                    ))}
                                  </div>
                                </div>
                                {item.issue.issueLink && (
                                  <a
                                    href={item.issue.issueLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-ghost btn-xs btn-circle"
                                    title="Open on GitHub"
                                  >
                                    <ExternalLink size={13} />
                                  </a>
                                )}
                                <button
                                  className="btn btn-error btn-outline btn-xs btn-circle"
                                  title="Reject — don't import"
                                  onClick={() => rs.handleReject(item.uid)}
                                  disabled={rs.approvingId === item.uid}
                                >
                                  <X size={13} />
                                </button>
                                <button
                                  className="btn btn-success btn-xs btn-circle"
                                  title="Approve — import now"
                                  onClick={() => rs.handleApprove(item.uid)}
                                  disabled={rs.approvingId === item.uid}
                                >
                                  {rs.approvingId === item.uid
                                    ? <span className="loading loading-spinner loading-xs" />
                                    : <CheckCircle size={13} />}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
          <button>close</button>
        </form>
      </dialog>

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
