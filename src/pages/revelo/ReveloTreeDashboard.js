import { useState, useEffect, useCallback } from 'react';
import {
  Loader, AlertCircle, Shield, Briefcase, Calendar,
  Send, CheckCircle, XCircle,
} from 'lucide-react';
import { getTreeDashboard } from '../../api/reveloApi';

// ─── Layout constants ─────────────────────────────────────────────────────────
// Top-down layout: User at top, Accounts in row, Jobs in row, Mini-circles row.
// Each job column = UNIT_W px. 3 mini circles of diameter 20px + 4px gaps = 68px = UNIT_W exactly.

const UNIT_W   = 68;   // column width per job slot
const EMPTY_W  = 54;   // column width for an account with no jobs
const JOB_GAP  = 8;    // horizontal gap between sibling jobs
const ACC_GAP  = 20;   // extra horizontal gap between accounts
const MINI_R   = 10;   // radius of each mini summary circle  (3 fit perfectly: 3×20 + 2×4 = 68)
const MINI_GAP = 4;    // gap between mini circles
const PAD_H    = 20;   // left / right canvas padding

// Y-center of each row
const LY = { user: 54, account: 166, job: 272, mini: 315 };

// Node radii
const NR = { user: 34, account: 26, job: 22 };

const TREE_H = 368; // total canvas height

// ─── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  user:      { ring: 'rgba(74,222,128,0.80)',  bg: 'rgba(74,222,128,0.11)',  text: '#4ade80',  edge: 'rgba(74,222,128,0.28)',  glow: 'rgba(74,222,128,0.4)'  },
  account:   { ring: 'rgba(96,165,250,0.75)',  bg: 'rgba(96,165,250,0.11)', text: '#60a5fa',  edge: 'rgba(96,165,250,0.24)',  glow: 'rgba(96,165,250,0.4)'  },
  job:       { ring: 'rgba(167,139,250,0.70)', bg: 'rgba(167,139,250,0.1)', text: '#a78bfa',  edge: 'rgba(167,139,250,0.22)', glow: 'rgba(167,139,250,0.4)' },
  submitted: { ring: 'rgba(251,146,60,0.75)',  bg: 'rgba(251,146,60,0.15)', text: '#fb923c' },
  approved:  { ring: 'rgba(74,222,128,0.75)',  bg: 'rgba(74,222,128,0.14)', text: '#4ade80' },
  rejected:  { ring: 'rgba(248,113,113,0.70)', bg: 'rgba(248,113,113,0.1)', text: '#f87171' },
};

const SUM_TYPES  = ['submitted', 'approved', 'rejected'];
const SUM_ICONS  = { submitted: Send, approved: CheckCircle, rejected: XCircle };
function miniOffsets(n) {
  const step   = MINI_R * 2 + MINI_GAP;
  const totalW = n * (MINI_R * 2) + (n - 1) * MINI_GAP;
  const start  = -(totalW / 2) + MINI_R;
  return Array.from({ length: n }, (_, i) => start + i * step);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMoney(v) {
  if (v == null || isNaN(v)) return null;
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function clamp99(n) { return n > 99 ? '99+' : (n ?? 0); }

function getToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function toISO(d)   { return d.toISOString().slice(0, 10); }

const PRESETS = [
  { key: 'all',   label: 'All Time'   },
  { key: 'today', label: 'Today'      },
  { key: 'week',  label: 'This Week'  },
  { key: 'month', label: 'This Month' },
  { key: 'custom',label: 'Custom'     },
];

function presetToDates(key) {
  const t = getToday();
  if (key === 'all')   return { startDate: null, endDate: null };
  if (key === 'today') return { startDate: toISO(t), endDate: toISO(t) };
  if (key === 'week')  { const s = new Date(t); s.setDate(s.getDate() - s.getDay()); return { startDate: toISO(s), endDate: toISO(t) }; }
  if (key === 'month') return { startDate: toISO(new Date(t.getFullYear(), t.getMonth(), 1)), endDate: toISO(t) };
  return null;
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function computeLayout(user) {
  const pos  = {};
  let cx = PAD_H;
  const accs = user.accounts || [];

  accs.forEach((acc, ai) => {
    const jobs = acc.jobs || [];
    const accW = jobs.length === 0
      ? EMPTY_W
      : jobs.length * UNIT_W + (jobs.length - 1) * JOB_GAP;

    pos[`a:${acc.id}`] = { x: cx + accW / 2, y: LY.account };

    jobs.forEach((job, ji) => {
      pos[`j:${job.id}:${acc.id}`] = {
        x: cx + UNIT_W / 2 + ji * (UNIT_W + JOB_GAP),
        y: LY.job,
      };
    });

    cx += accW;
    if (ai < accs.length - 1) cx += ACC_GAP;
  });

  cx += PAD_H;
  const width = Math.max(cx, NR.user * 2 + PAD_H * 2);
  pos[`u:${user.id}`] = { x: width / 2, y: LY.user };

  return { pos, width };
}

// ─── SVG vertical Bezier ──────────────────────────────────────────────────────
function vcurve(x1, y1, x2, y2) {
  const my = (y1 + y2) / 2;
  return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
}

// ─── Date range bar ───────────────────────────────────────────────────────────
function DateRangeBar({ range, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [cs, setCs] = useState('');
  const [ce, setCe] = useState('');

  const pick = (key) => {
    if (key === 'custom') { setShowCustom(true); return; }
    setShowCustom(false);
    onChange(presetToDates(key));
  };

  const activeKey = !range.startDate && !range.endDate ? 'all'
    : PRESETS.slice(1, -1).find(p => {
        const d = presetToDates(p.key);
        return d && d.startDate === range.startDate && d.endDate === range.endDate;
      })?.key || 'custom';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
      <Calendar size={13} style={{ color: 'rgba(134,239,172,0.5)', flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESETS.map(p => {
          const active = activeKey === p.key || (p.key === 'custom' && showCustom);
          return (
            <button key={p.key} onClick={() => pick(p.key)} style={{
              padding: '3px 11px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: active ? 'rgba(74,222,128,0.17)' : 'transparent',
              border: `1px solid ${active ? 'rgba(74,222,128,0.45)' : 'rgba(74,222,128,0.12)'}`,
              color:  active ? '#4ade80' : 'rgba(134,239,172,0.5)',
              transition: 'all 0.12s',
            }}>{p.label}</button>
          );
        })}
      </div>
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={cs} onChange={e => setCs(e.target.value)}
            style={{ padding: '3px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(3,18,9,0.8)',
              border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
          <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>–</span>
          <input type="date" value={ce} onChange={e => setCe(e.target.value)}
            style={{ padding: '3px 7px', borderRadius: 6, fontSize: 11, background: 'rgba(3,18,9,0.8)',
              border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
          <button onClick={() => onChange({ startDate: cs || null, endDate: ce || null })}
            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80', fontWeight: 600 }}>Apply</button>
        </div>
      )}
    </div>
  );
}

// ─── Popover ──────────────────────────────────────────────────────────────────
function StatRow({ label, count, cost, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 3 }}>
      <span style={{ color: 'rgba(134,239,172,0.5)', fontSize: 10 }}>{label}</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>{count ?? 0}</span>
        {fmtMoney(cost) && <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10 }}>{fmtMoney(cost)}</span>}
      </div>
    </div>
  );
}

function PopoverContent({ type, data }) {
  if (type === 'user') {
    return (
      <>
        <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
          {data.displayName || data.username}
          <span style={{ color: 'rgba(134,239,172,0.4)', fontWeight: 400, fontSize: 10, marginLeft: 5 }}>@{data.username}</span>
        </div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {(data.accounts || []).length} accounts
        </div>
        <StatRow label="Submitted" count={data.totals?.submitted?.count} cost={data.totals?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={data.totals?.approved?.count}  cost={data.totals?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={data.totals?.rejected?.count}  cost={data.totals?.rejected?.cost}  color={C.rejected.text}  />
      </>
    );
  }
  if (type === 'account') {
    return (
      <>
        <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{data.name}</div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
          {(data.jobs || []).length} jobs
        </div>
        <StatRow label="Submitted" count={data.totals?.submitted?.count} cost={data.totals?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={data.totals?.approved?.count}  cost={data.totals?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={data.totals?.rejected?.count}  cost={data.totals?.rejected?.cost}  color={C.rejected.text}  />
      </>
    );
  }
  if (type === 'job') {
    const { job, stats } = data;
    const s = stats?.submitted?.count || 0;
    const a = stats?.approved?.count  || 0;
    const r = stats?.rejected?.count  || 0;
    const ap = s > 0 ? Math.round((a / s) * 100) : 0;
    const rp = s > 0 ? Math.round((r / s) * 100) : 0;
    return (
      <>
        <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12, marginBottom: 3 }}>{job?.jobName}</div>
        {(job?.hourlyRate || job?.jobMaxPayableTime) && (
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 9, marginBottom: 6 }}>
            {job.hourlyRate ? `$${job.hourlyRate}/hr` : ''}
            {job.jobMaxPayableTime ? ` · ${job.jobMaxPayableTime}hr/task` : ''}
            {job.hourlyRate && job.jobMaxPayableTime
              ? ` · ${fmtMoney(job.hourlyRate * job.jobMaxPayableTime)}/task` : ''}
          </div>
        )}
        <StatRow label="Submitted" count={s} cost={stats?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={a} cost={stats?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={r} cost={stats?.rejected?.cost}  color={C.rejected.text}  />
        {s > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${ap}%`, background: '#4ade80' }} />
              <div style={{ width: `${rp}%`, background: '#f87171' }} />
            </div>
            <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, marginTop: 3 }}>{ap}% approved</div>
          </div>
        )}
      </>
    );
  }
  if (type === 'mini') {
    const col = C[data.sumType];
    return (
      <>
        <div style={{ color: col.text, fontWeight: 700, fontSize: 12, textTransform: 'capitalize', marginBottom: 5 }}>
          {data.sumType}
        </div>
        <StatRow label="Tasks" count={data.stats?.count} cost={data.stats?.cost} color={col.text} />
        {data.job && <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, marginTop: 5 }}>Job: {data.job.jobName}</div>}
      </>
    );
  }
  return null;
}

// ─── Node circle ──────────────────────────────────────────────────────────────
function NodeCircle({ x, y, r, col, hovered, children, label, sublabel, onMouseEnter, onMouseLeave }) {
  if (x == null || y == null) return null;
  return (
    <g style={{ cursor: 'pointer' }} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {/* glow ring when hovered */}
      {hovered && (
        <circle cx={x} cy={y} r={r + 6}
          fill="none"
          stroke={col.glow || col.ring}
          strokeWidth={1}
          opacity={0.5}
        />
      )}
      {/* main circle — rendered as foreignObject so we can put HTML inside */}
      <foreignObject x={x - r} y={y - r} width={r * 2} height={r * 2} style={{ overflow: 'visible' }}>
        <div style={{
          width: r * 2, height: r * 2, borderRadius: '50%',
          background: col.bg,
          border: `2px solid ${col.ring}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: hovered ? `0 0 14px ${col.glow || col.ring}` : '0 2px 6px rgba(0,0,0,0.45)',
          transition: 'box-shadow 0.14s',
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          transformOrigin: 'center',
        }}>
          {children}
        </div>
      </foreignObject>
    </g>
  );
}

// ─── User tree ────────────────────────────────────────────────────────────────
function hasTaskData(job) {
  const s = job.stats || {};
  return (s.submitted?.count || 0) + (s.approved?.count || 0) + (s.rejected?.count || 0) > 0;
}

function UserTree({ user }) {
  const [hovered, setHovered] = useState(null); // { key, type, data, x, y }

  const filteredUser = {
    ...user,
    accounts: (user.accounts || []).map(acc => ({
      ...acc,
      jobs: (acc.jobs || []).filter(hasTaskData),
    })),
  };

  const { pos, width } = computeLayout(filteredUser);

  const uPos = pos[`u:${filteredUser.id}`];
  const accs = filteredUser.accounts;

  // Build edge list
  const edges = [];
  accs.forEach(acc => {
    const aPos = pos[`a:${acc.id}`];
    if (!aPos || !uPos) return;
    edges.push({
      key: `eu:${acc.id}`,
      d: vcurve(uPos.x, LY.user + NR.user, aPos.x, LY.account - NR.account),
      stroke: C.account.edge, w: 1.8,
    });
    (acc.jobs || []).forEach(job => {
      const jPos = pos[`j:${job.id}:${acc.id}`];
      if (!jPos) return;
      edges.push({
        key: `ea:${job.id}:${acc.id}`,
        d: vcurve(aPos.x, LY.account + NR.account, jPos.x, LY.job - NR.job),
        stroke: C.job.edge, w: 1.5,
      });
    });
  });

  const hover  = (key, type, data, x, y) => () => setHovered({ key, type, data, x, y });
  const unhover = () => setHovered(null);

  // Popover placement
  const POP_W = 224;
  const popStyle = hovered ? (() => {
    const rightX = hovered.x + 30 + 10;
    const left = rightX + POP_W > width ? hovered.x - 30 - 10 - POP_W : rightX;
    const top  = Math.max(0, Math.min(hovered.y - 60, TREE_H - 180));
    return { left, top };
  })() : {};

  return (
    <div style={{ position: 'relative', width, height: TREE_H, flexShrink: 0 }}>
      <svg
        width={width} height={TREE_H}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
      >
        {/* ── Edges ── */}
        {edges.map(e => (
          <path key={e.key} d={e.d} fill="none"
            stroke={e.stroke} strokeWidth={e.w} strokeLinecap="round" />
        ))}

        {/* ── User circle ── */}
        {uPos && (
          <NodeCircle x={uPos.x} y={uPos.y} r={NR.user} col={C.user}
            hovered={hovered?.key === `u:${filteredUser.id}`}
            onMouseEnter={hover(`u:${filteredUser.id}`, 'user', filteredUser, uPos.x, uPos.y)}
            onMouseLeave={unhover}
          >
            {filteredUser.avatarUrl
              ? <img src={filteredUser.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ color: C.user.text, fontWeight: 800, fontSize: 14, userSelect: 'none' }}>
                  {(filteredUser.displayName || filteredUser.username || '?').slice(0, 2).toUpperCase()}
                </span>
            }
          </NodeCircle>
        )}

        {/* ── Account circles ── */}
        {accs.map(acc => {
          const aPos = pos[`a:${acc.id}`];
          if (!aPos) return null;
          const isHov = hovered?.key === `a:${acc.id}`;
          return (
            <NodeCircle key={`a:${acc.id}`} x={aPos.x} y={aPos.y} r={NR.account} col={C.account}
              hovered={isHov}
              onMouseEnter={hover(`a:${acc.id}`, 'account', acc, aPos.x, aPos.y)}
              onMouseLeave={unhover}
            >
              <Shield size={13} style={{ color: C.account.text }} />
            </NodeCircle>
          );
        })}

        {/* ── Job circles ── */}
        {accs.flatMap(acc =>
          (acc.jobs || []).map(job => {
            const jPos = pos[`j:${job.id}:${acc.id}`];
            if (!jPos) return null;
            const isHov = hovered?.key === `j:${job.id}:${acc.id}`;
            return (
              <NodeCircle key={`j:${job.id}:${acc.id}`} x={jPos.x} y={jPos.y} r={NR.job} col={C.job}
                hovered={isHov}
                onMouseEnter={hover(`j:${job.id}:${acc.id}`, 'job', { job, stats: job.stats }, jPos.x, jPos.y)}
                onMouseLeave={unhover}
              >
                <Briefcase size={11} style={{ color: C.job.text }} />
              </NodeCircle>
            );
          })
        )}

        {/* ── Mini summary circles ── */}
        {accs.flatMap(acc =>
          (acc.jobs || []).flatMap(job => {
            const jPos = pos[`j:${job.id}:${acc.id}`];
            if (!jPos) return [];
            const activeTypes = SUM_TYPES.filter(t => (job.stats?.[t]?.count || 0) > 0);
            const offsets = miniOffsets(activeTypes.length);
            return activeTypes.map((type, ti) => {
              const stats  = job.stats?.[type] || { count: 0, cost: null };
              const col    = C[type];
              const mx     = jPos.x + offsets[ti];
              const my     = LY.mini;
              const key    = `m:${job.id}:${acc.id}:${type}`;
              const isHov  = hovered?.key === key;
              return (
                <g key={key} style={{ cursor: 'pointer' }}
                  onMouseEnter={hover(key, 'mini', { sumType: type, stats, job }, mx, my)}
                  onMouseLeave={unhover}
                >
                  {isHov && <circle cx={mx} cy={my} r={MINI_R + 4} fill="none" stroke={col.ring} strokeWidth={1} opacity={0.4} />}
                  <circle cx={mx} cy={my} r={MINI_R}
                    fill={col.bg}
                    stroke={col.ring}
                    strokeWidth={isHov ? 1.8 : 1.2}
                  />
                  <foreignObject x={mx - MINI_R} y={my - MINI_R} width={MINI_R * 2} height={MINI_R * 2}>
                    <div style={{
                      width: MINI_R * 2, height: MINI_R * 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: col.text, fontWeight: 800, fontSize: 8, lineHeight: 1, userSelect: 'none' }}>
                        {clamp99(stats.count)}
                      </span>
                    </div>
                  </foreignObject>
                </g>
              );
            });
          })
        )}
      </svg>

      {/* ── HTML labels (outside SVG for crisp text) ── */}
      {/* User label */}
      {uPos && (
        <div style={{
          position: 'absolute',
          left: uPos.x, top: LY.user + NR.user + 6,
          transform: 'translateX(-50%)',
          textAlign: 'center', pointerEvents: 'none', zIndex: 3,
          width: 90,
        }}>
          <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 10, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {filteredUser.displayName || filteredUser.username}
          </div>
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 9, lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
            @{filteredUser.username}
          </div>
        </div>
      )}

      {/* Account labels */}
      {accs.map(acc => {
        const aPos = pos[`a:${acc.id}`];
        if (!aPos) return null;
        const accW = (acc.jobs || []).length === 0
          ? EMPTY_W
          : (acc.jobs || []).length * UNIT_W + ((acc.jobs || []).length - 1) * JOB_GAP;
        return (
          <div key={`lbl-a:${acc.id}`} style={{
            position: 'absolute',
            left: aPos.x, top: LY.account + NR.account + 5,
            transform: 'translateX(-50%)',
            textAlign: 'center', pointerEvents: 'none', zIndex: 3,
            width: Math.min(accW, 120),
          }}>
            <div style={{ color: '#93c5fd', fontSize: 9, fontWeight: 600, lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {acc.name}
            </div>
          </div>
        );
      })}

      {/* Job labels (short, above mini circles) */}
      {accs.flatMap(acc =>
        (acc.jobs || []).map(job => {
          const jPos = pos[`j:${job.id}:${acc.id}`];
          if (!jPos) return null;
          return (
            <div key={`lbl-j:${job.id}:${acc.id}`} style={{
              position: 'absolute',
              left: jPos.x, top: LY.job + NR.job + 4,
              transform: 'translateX(-50%)',
              textAlign: 'center', pointerEvents: 'none', zIndex: 3,
              width: UNIT_W,
            }}>
              <div style={{ color: '#c4b5fd', fontSize: 8, fontWeight: 600, lineHeight: 1.2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {job.jobName}
              </div>
            </div>
          );
        })
      )}

      {/* Mini circle type labels */}
      {accs.flatMap(acc =>
        (acc.jobs || []).flatMap(job => {
          const jPos = pos[`j:${job.id}:${acc.id}`];
          if (!jPos) return [];
          const activeTypes = SUM_TYPES.filter(t => (job.stats?.[t]?.count || 0) > 0);
          const offsets = miniOffsets(activeTypes.length);
          return activeTypes.map((type, ti) => (
            <div key={`lbl-m:${job.id}:${acc.id}:${type}`} style={{
              position: 'absolute',
              left: jPos.x + offsets[ti], top: LY.mini + MINI_R + 3,
              transform: 'translateX(-50%)',
              color: C[type].text, fontSize: 7, fontWeight: 600,
              opacity: 0.65, pointerEvents: 'none', zIndex: 3,
              textTransform: 'uppercase', letterSpacing: '0.02em',
              userSelect: 'none',
            }}>
              {type.slice(0, 3)}
            </div>
          ));
        })
      )}

      {/* ── Popover ── */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: popStyle.left, top: popStyle.top,
          width: POP_W,
          background: 'rgba(2,11,5,0.97)',
          border: '1px solid rgba(74,222,128,0.18)',
          borderRadius: 12,
          padding: '11px 13px',
          zIndex: 200,
          pointerEvents: 'none',
          boxShadow: '0 8px 30px rgba(0,0,0,0.75), 0 0 0 1px rgba(74,222,128,0.06)',
          backdropFilter: 'blur(10px)',
          animation: 'treePopIn 0.11s ease',
        }}>
          <PopoverContent type={hovered.type} data={hovered.data} />
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ReveloTreeDashboard() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [range,   setRange]   = useState({ startDate: null, endDate: null });

  const load = useCallback(() => {
    setLoading(true); setError('');
    getTreeDashboard({ startDate: range.startDate, endDate: range.endDate })
      .then(r => { if (r.success) setUsers(r.users); else setError(r.message); })
      .catch(e => setError(e.response?.data?.message || e.message))
      .finally(() => setLoading(false));
  }, [range.startDate, range.endDate]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container mx-auto max-w-screen-lg px-4 py-6">
      <style>{`
        @keyframes treePopIn {
          from { opacity: 0; transform: scale(0.93) translateY(-3px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      <DateRangeBar range={range} onChange={setRange} />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader size={26} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderRadius: 12, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={15} style={{ color: '#f87171' }} />
          <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(134,239,172,0.35)', fontSize: 13 }}>
          No members yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {users.map((u, i) => (
            <div key={u.id}>
              {i > 0 && (
                <div style={{ height: 1, background: 'rgba(74,222,128,0.07)', margin: '8px 0 16px' }} />
              )}
              <div style={{ overflowX: 'auto', overflowY: 'visible', paddingBottom: 8 }}>
                <UserTree user={u} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
