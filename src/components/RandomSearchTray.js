import { useState, useEffect } from 'react';
import {
  Sparkles, ChevronDown, Play, Square, CheckCircle, X,
  CheckCheck, XCircle, ExternalLink, Maximize2, Minimize2,
  Trash2, Link,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRandomSearch } from '../context/RandomSearchContext';
import { useAuth } from '../context/AuthContext';

const LANG_BADGE = {
  Python:     { label: 'PY', color: '#2196f3' },
  JavaScript: { label: 'JS', color: '#f59e0b' },
  TypeScript: { label: 'TS', color: '#6366f1' },
};

export default function RandomSearchTray() {
  const { user } = useAuth();
  const rs       = useRandomSearch();
  const navigate = useNavigate();
  const [wide, setWide] = useState(false);

  // Auto-dismiss snack after 8s
  useEffect(() => {
    if (!rs.doneSnack) return;
    const t = setTimeout(() => rs.setDoneSnack(''), 8000);
    return () => clearTimeout(t);
  }, [rs.doneSnack]);

  if (!user) return null;

  const cardWidth = wide ? 560 : 360;

  function goToSearch() {
    navigate('/github-issues', { state: { openSmartSearch: true, initialTab: 3 } });
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

        {/* ── Expanded card ───────────────────────────────────────────────── */}
        {rs.trayExpanded && (
          <div
            className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden flex flex-col"
            style={{ width: cardWidth, transition: 'width 0.2s ease' }}
          >
            {/* Header */}
            <div className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-content shrink-0">
              <Sparkles size={14} />
              <span className="text-xs font-bold flex-1">Random Search</span>
              {rs.running && <span className="loading loading-spinner loading-xs" />}
              <span className={`badge badge-xs font-bold text-white ${rs.running ? 'badge-success' : 'badge-ghost'}`}>
                {rs.running ? 'Running' : 'Stopped'}
              </span>
              <div className="tooltip tooltip-left" data-tip="Open in Smart Search">
                <button className="btn btn-ghost btn-xs text-primary-content p-0.5" onClick={goToSearch}>
                  <ExternalLink size={13} />
                </button>
              </div>
              <div className="tooltip tooltip-left" data-tip="Clear search log & queue">
                <button className="btn btn-ghost btn-xs text-primary-content/75 p-0.5" onClick={rs.clearAll}>
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="tooltip tooltip-left" data-tip={wide ? 'Narrow' : 'Widen'}>
                <button className="btn btn-ghost btn-xs text-primary-content p-0.5" onClick={() => setWide(v => !v)}>
                  {wide ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>
              <div className="tooltip tooltip-left" data-tip="Minimize">
                <button className="btn btn-ghost btn-xs text-primary-content p-0.5" onClick={() => rs.setTrayExpanded(false)}>
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>

            {/* Stats + controls */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-base-200 shrink-0 flex-wrap">
              <span className="badge badge-success badge-outline badge-sm text-[10px]">{rs.imported} imported</span>
              {rs.queue.length > 0 && (
                <span className="badge badge-warning badge-outline badge-sm text-[10px]">{rs.queue.length} pending</span>
              )}
              {rs.restoredFromDB && !rs.running && (
                <span className="badge badge-info badge-outline badge-sm text-[10px]">Restored</span>
              )}
              <div className="flex-1" />
              {rs.running ? (
                <button className="btn btn-error btn-xs h-5 min-h-0 px-2 text-[10px]" onClick={rs.stopSearch}>
                  <Square size={10} /> Stop
                </button>
              ) : (
                <button className="btn btn-secondary btn-xs h-5 min-h-0 px-2 text-[10px]" onClick={rs.startSearch}>
                  <Play size={10} />
                  {rs.log?.length > 0 || rs.imported > 0 || rs.queue.length > 0 ? 'Continue' : 'Start'}
                </button>
              )}
            </div>

            {/* Issue queue list */}
            <div
              className="flex-1 overflow-y-auto border-t border-base-300"
              style={{ maxHeight: wide ? 480 : 360, minHeight: 80 }}
            >
              {rs.queue.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2">
                  {rs.running ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      <span className="text-xs text-base-content/40">Searching for issues…</span>
                    </>
                  ) : (
                    <span className="text-xs text-base-content/40">No pending issues — click Start to begin</span>
                  )}
                </div>
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
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-base-300">
              {rs.queue.length > 0 && (
                <div className="flex gap-2 px-3 py-1.5">
                  <button className="btn btn-success btn-outline btn-xs flex-1 text-[11px]" onClick={rs.handleApproveAll}>
                    <CheckCheck size={12} /> Approve All ({rs.queue.length})
                  </button>
                  <button className="btn btn-error btn-outline btn-xs flex-1 text-[11px]" onClick={rs.handleRejectAll}>
                    <XCircle size={12} /> Reject All
                  </button>
                </div>
              )}
              <div className="px-3 py-1.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  className="toggle toggle-success toggle-xs"
                  checked={rs.autoApprove}
                  onChange={(e) => rs.setAutoApprove(e.target.checked)}
                />
                <span className="text-xs text-base-content/60">Auto-approve</span>
              </div>
            </div>
          </div>
        )}

        {/* ── FAB ─────────────────────────────────────────────────────────── */}
        <div className="tooltip tooltip-left" data-tip={rs.trayExpanded ? 'Minimize' : 'Random Search'}>
          <button
            className={`btn btn-circle btn-lg shadow-lg relative ${rs.running ? 'btn-secondary' : 'btn-primary'}`}
            onClick={() => rs.setTrayExpanded(v => !v)}
          >
            {rs.running && (
              <span className="loading loading-spinner loading-lg absolute opacity-40" />
            )}
            <Sparkles size={22} />
            {rs.queue.length > 0 && (
              <span className="badge badge-warning badge-xs absolute -top-1 -right-1 font-bold text-[9px] min-w-4">
                {rs.queue.length > 99 ? '99+' : rs.queue.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {rs.doneSnack && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div role="alert" className="alert alert-info shadow-lg">
            <span className="text-sm">{rs.doneSnack}</span>
            <button className="btn btn-ghost btn-xs" onClick={() => rs.setDoneSnack('')}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Issue card ─────────────────────────────────────────────────────────────────

function IssueCard({ item, wide, approving, onApprove, onReject }) {
  const { issue, score } = item;
  const scoreBadge = score >= 75 ? 'badge-success' : score >= 50 ? 'badge-warning' : 'badge-error';
  const lang       = LANG_BADGE[issue.repoCategory];

  const repoName  = issue.repoName   || '';
  const title     = issue.issueTitle || '(no title)';
  const issueLink = issue.issueLink  || '';

  const issueNumMatch = issueLink.match(/\/issues\/(\d+)$/);
  const issueNum = issueNumMatch ? `#${issueNumMatch[1]}` : '';

  return (
    <div className="px-3 py-2 border-b border-base-300 bg-base-100 hover:bg-base-200 transition-colors">
      {/* Row 1: title + link icon */}
      <div className="flex items-start gap-1 mb-1">
        <p
          className="flex-1 text-xs font-semibold leading-snug min-w-0"
          style={{
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: wide ? 3 : 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {title}
        </p>
        {issueLink && (
          <a
            href={issueLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="btn btn-ghost btn-xs p-0.5 shrink-0 text-base-content/40 hover:text-primary"
          >
            <Link size={12} />
          </a>
        )}
      </div>

      {/* Row 2: meta badges */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        <span
          className="text-[10px] text-base-content/40 truncate"
          style={{ maxWidth: wide ? 220 : 140 }}
        >
          {repoName}{issueNum ? ` · ${issueNum}` : ''}
        </span>
        {lang && (
          <span
            className="text-[9px] font-bold text-white px-1 rounded-sm leading-4"
            style={{ backgroundColor: lang.color }}
          >
            {lang.label}
          </span>
        )}
        <span className={`badge badge-outline badge-xs ${scoreBadge} text-[9px]`}>{score}</span>
        {issue.prLink && (
          <span className="badge badge-success badge-outline badge-xs text-[9px]">PR</span>
        )}
      </div>

      {/* Row 3: approve / reject */}
      <div className="flex gap-1.5">
        <button
          className="btn btn-success btn-xs flex-1 text-[10px]"
          disabled={approving}
          onClick={onApprove}
        >
          {approving
            ? <span className="loading loading-spinner loading-xs" />
            : <CheckCircle size={11} />}
          Approve
        </button>
        <button className="btn btn-error btn-outline btn-xs shrink-0 text-[10px]" onClick={onReject}>
          <X size={11} /> Reject
        </button>
      </div>
    </div>
  );
}
