import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader, AlertCircle, Shield, Briefcase,
  Send, CheckCircle, XCircle, ChevronDown, Calendar,
} from 'lucide-react';
import { getTreeDashboard } from '../../api/reveloApi';

// ─── Layout constants ─────────────────────────────────────────────────────────

const COL_X  = [92,  268, 428, 578]; // horizontal center per level
const NODE_R = [35,   27,  23,  20]; // radius per level (user/acc/job/sum)
const LEAF_H = 76;   // vertical space per summary slot
const JOB_GAP  = 20; // extra gap between job groups (within account)
const ACC_GAP  = 38; // extra gap between account groups (within user)
const TREE_PAD = 24; // top/bottom padding for each user tree
const TREE_W   = 720;

// ─── Color tokens per node type ───────────────────────────────────────────────

const C = {
  user:      { ring: 'rgba(74,222,128,0.75)',  bg: 'rgba(74,222,128,0.11)',  text: '#4ade80',  edge: 'rgba(74,222,128,0.28)',  glow: 'rgba(74,222,128,0.35)'  },
  account:   { ring: 'rgba(96,165,250,0.70)',  bg: 'rgba(96,165,250,0.11)', text: '#60a5fa',  edge: 'rgba(96,165,250,0.22)',  glow: 'rgba(96,165,250,0.35)'  },
  job:       { ring: 'rgba(167,139,250,0.65)', bg: 'rgba(167,139,250,0.1)', text: '#a78bfa',  edge: 'rgba(167,139,250,0.2)',  glow: 'rgba(167,139,250,0.35)' },
  submitted: { ring: 'rgba(251,146,60,0.70)',  bg: 'rgba(251,146,60,0.11)', text: '#fb923c',  edge: 'rgba(251,146,60,0.22)',  glow: 'rgba(251,146,60,0.35)'  },
  approved:  { ring: 'rgba(74,222,128,0.70)',  bg: 'rgba(74,222,128,0.11)', text: '#4ade80',  edge: 'rgba(74,222,128,0.22)',  glow: 'rgba(74,222,128,0.35)'  },
  rejected:  { ring: 'rgba(248,113,113,0.65)', bg: 'rgba(248,113,113,0.1)', text: '#f87171',  edge: 'rgba(248,113,113,0.2)',  glow: 'rgba(248,113,113,0.35)' },
};

const SUM_ICONS = { submitted: Send, approved: CheckCircle, rejected: XCircle };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(v) {
  if (v == null || isNaN(v)) return null;
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISO(d) { return d.toISOString().slice(0, 10); }

const PRESETS = [
  { key: 'all',   label: 'All Time'  },
  { key: 'today', label: 'Today'     },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month'},
  { key: 'custom',label: 'Custom'    },
];

function presetToDates(key) {
  const today = getToday();
  if (key === 'all')   return { startDate: null, endDate: null };
  if (key === 'today') return { startDate: toISO(today), endDate: toISO(today) };
  if (key === 'week') {
    const s = new Date(today);
    s.setDate(s.getDate() - s.getDay());
    return { startDate: toISO(s), endDate: toISO(today) };
  }
  if (key === 'month') {
    return { startDate: toISO(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: toISO(today) };
  }
  return null; // custom
}

// ─── Layout ───────────────────────────────────────────────────────────────────

function computeLayout(user) {
  const pos = {};
  let cy = TREE_PAD;

  const accs = user.accounts || [];
  if (accs.length === 0) {
    pos[`u:${user.id}`] = { x: COL_X[0], y: cy + NODE_R[0] };
    return { pos, height: NODE_R[0] * 2 + TREE_PAD * 2 };
  }

  accs.forEach((acc, ai) => {
    const accStart = cy;
    const jobs = acc.jobs || [];

    if (jobs.length === 0) {
      // Empty account: one placeholder row
      pos[`a:${acc.id}`] = { x: COL_X[1], y: cy + LEAF_H * 1.5 };
      cy += LEAF_H * 3;
    } else {
      jobs.forEach((job, ji) => {
        const jTop = cy;
        // 3 summary nodes
        ['submitted', 'approved', 'rejected'].forEach((type, ti) => {
          pos[`s:${job.id}:${acc.id}:${type}`] = {
            x: COL_X[3],
            y: jTop + LEAF_H * (ti + 0.5),
          };
        });
        // Job node centered on middle summary
        pos[`j:${job.id}:${acc.id}`] = { x: COL_X[2], y: jTop + LEAF_H * 1.5 };
        cy += LEAF_H * 3;
        if (ji < jobs.length - 1) cy += JOB_GAP;
      });
      // Account node: vertical center of its job range
      pos[`a:${acc.id}`] = { x: COL_X[1], y: (accStart + cy) / 2 };
    }

    if (ai < accs.length - 1) cy += ACC_GAP;
  });

  cy += TREE_PAD;
  pos[`u:${user.id}`] = { x: COL_X[0], y: cy / 2 };
  return { pos, height: cy };
}

// ─── SVG curve ────────────────────────────────────────────────────────────────

function curvePath(x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

// ─── Date range bar ───────────────────────────────────────────────────────────

function DateRangeBar({ range, onChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [customS,    setCustomS]    = useState('');
  const [customE,    setCustomE]    = useState('');

  const pick = (key) => {
    if (key === 'custom') { setShowCustom(true); return; }
    setShowCustom(false);
    onChange(presetToDates(key));
  };

  const applyCustom = () => {
    if (customS || customE) onChange({ startDate: customS || null, endDate: customE || null });
  };

  const active = range.startDate || range.endDate ? 'custom'
    : Object.keys(PRESETS.reduce((a, p) => { a[p.key] = p; return a; }, {}))
        .find(k => {
          if (k === 'all' || k === 'custom') return false;
          const d = presetToDates(k);
          return d && d.startDate === range.startDate && d.endDate === range.endDate;
        }) || 'all';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      <Calendar size={13} style={{ color: 'rgba(134,239,172,0.5)', flexShrink: 0 }} />
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESETS.map(p => (
          <button key={p.key}
            onClick={() => pick(p.key)}
            style={{
              padding: '4px 12px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background:   (active === p.key || (p.key === 'custom' && showCustom)) ? 'rgba(74,222,128,0.18)' : 'transparent',
              border:       (active === p.key || (p.key === 'custom' && showCustom)) ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(74,222,128,0.12)',
              color:        (active === p.key || (p.key === 'custom' && showCustom)) ? '#4ade80' : 'rgba(134,239,172,0.5)',
              transition:   'all 0.12s',
            }}>
            {p.label}
          </button>
        ))}
      </div>
      {showCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={customS} onChange={e => setCustomS(e.target.value)}
            style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(3,18,9,0.8)',
              border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
          <span style={{ color: 'rgba(134,239,172,0.35)', fontSize: 11 }}>–</span>
          <input type="date" value={customE} onChange={e => setCustomE(e.target.value)}
            style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, background: 'rgba(3,18,9,0.8)',
              border: '1px solid rgba(74,222,128,0.2)', color: '#bbf7d0', outline: 'none' }} />
          <button onClick={applyCustom}
            style={{ padding: '3px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)',
              color: '#4ade80', fontWeight: 600 }}>
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Popover content ──────────────────────────────────────────────────────────

function StatRow({ label, count, cost, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ color: 'rgba(134,239,172,0.5)', fontSize: 10 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color, fontWeight: 700, fontSize: 12 }}>{count ?? 0}</span>
        {fmtMoney(cost) && (
          <span style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10 }}>{fmtMoney(cost)}</span>
        )}
      </div>
    </div>
  );
}

function PopoverInner({ type, data }) {
  if (type === 'user') {
    return (
      <>
        <div style={{ color: '#bbf7d0', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
          {data.displayName || data.username}
          <span style={{ color: 'rgba(134,239,172,0.4)', fontWeight: 400, fontSize: 10, marginLeft: 5 }}>@{data.username}</span>
        </div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          Total ({(data.accounts || []).length} accounts)
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
        <div style={{ color: '#93c5fd', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>{data.name}</div>
        <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
          {(data.jobs || []).length} jobs linked
        </div>
        <StatRow label="Submitted" count={data.totals?.submitted?.count} cost={data.totals?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={data.totals?.approved?.count}  cost={data.totals?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={data.totals?.rejected?.count}  cost={data.totals?.rejected?.cost}  color={C.rejected.text}  />
      </>
    );
  }
  if (type === 'job') {
    return (
      <>
        <div style={{ color: '#c4b5fd', fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{data.job?.jobName}</div>
        {data.job?.hourlyRate && (
          <div style={{ color: 'rgba(134,239,172,0.4)', fontSize: 10, marginBottom: 8 }}>
            ${data.job.hourlyRate}/hr{data.job.jobMaxPayableTime ? ` · ${data.job.jobMaxPayableTime}hr/task` : ''}
          </div>
        )}
        <StatRow label="Submitted" count={data.stats?.submitted?.count} cost={data.stats?.submitted?.cost} color={C.submitted.text} />
        <StatRow label="Approved"  count={data.stats?.approved?.count}  cost={data.stats?.approved?.cost}  color={C.approved.text}  />
        <StatRow label="Rejected"  count={data.stats?.rejected?.count}  cost={data.stats?.rejected?.cost}  color={C.rejected.text}  />
        {(data.stats?.submitted?.count > 0) && (() => {
          const s = data.stats.submitted.count;
          const a = data.stats.approved.count || 0;
          const r = data.stats.rejected.count || 0;
          const ap = Math.round((a / s) * 100);
          return (
            <div style={{ marginTop: 8 }}>
              <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', display: 'flex', overflow: 'hidden' }}>
                <div style={{ width: `${ap}%`, background: '#4ade80' }} />
                <div style={{ width: `${Math.round((r / s) * 100)}%`, background: '#f87171' }} />
              </div>
              <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, marginTop: 3 }}>{ap}% approved</div>
            </div>
          );
        })()}
      </>
    );
  }
  if (type === 'summary') {
    const colr = C[data.sumType] || C.submitted;
    return (
      <>
        <div style={{ color: colr.text, fontWeight: 700, fontSize: 12, marginBottom: 6, textTransform: 'capitalize' }}>
          {data.sumType}
        </div>
        <StatRow label="Tasks" count={data.stats?.count} cost={data.stats?.cost} color={colr.text} />
        {data.job && (
          <div style={{ color: 'rgba(134,239,172,0.35)', fontSize: 9, marginTop: 6 }}>
            Job: {data.job.jobName}
          </div>
        )}
      </>
    );
  }
  return null;
}

// ─── One user's tree ──────────────────────────────────────────────────────────

function UserTree({ user }) {
  const [hovered, setHovered] = useState(null); // { key, type, data, x, y }
  const containerRef = useRef(null);

  const { pos, height } = computeLayout(user);

  // Build edge list
  const edges = [];
  const accs = user.accounts || [];
  const uPos = pos[`u:${user.id}`];

  accs.forEach(acc => {
    const aPos = pos[`a:${acc.id}`];
    if (!aPos || !uPos) return;

    edges.push({
      key: `e:u-a:${acc.id}`,
      d: curvePath(uPos.x + NODE_R[0], uPos.y, aPos.x - NODE_R[1], aPos.y),
      stroke: C.account.edge, width: 1.8,
    });

    (acc.jobs || []).forEach(job => {
      const jPos = pos[`j:${job.id}:${acc.id}`];
      if (!jPos) return;

      edges.push({
        key: `e:a-j:${job.id}:${acc.id}`,
        d: curvePath(aPos.x + NODE_R[1], aPos.y, jPos.x - NODE_R[2], jPos.y),
        stroke: C.job.edge, width: 1.5,
      });

      ['submitted', 'approved', 'rejected'].forEach(type => {
        const sPos = pos[`s:${job.id}:${acc.id}:${type}`];
        if (!sPos) return;
        edges.push({
          key: `e:j-s:${job.id}:${acc.id}:${type}`,
          d: curvePath(jPos.x + NODE_R[2], jPos.y, sPos.x - NODE_R[3], sPos.y),
          stroke: C[type].edge, width: 1.3,
        });
      });
    });
  });

  // Resolve popover position: prefer right, fall back to left
  const popW = 228;
  const popoverStyle = hovered ? (() => {
    const r = NODE_R[['user','account','job','summary'].indexOf(hovered.type)] ?? 20;
    const rightX = hovered.x + r + 14;
    const left = rightX + popW > TREE_W ? hovered.x - r - 14 - popW : rightX;
    const top  = Math.max(4, hovered.y - 72);
    return { left, top };
  })() : {};

  const makeHover = (key, type, data, x, y) => ({
    onMouseEnter: () => setHovered({ key, type, data, x, y }),
    onMouseLeave: () => setHovered(null),
  });

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: TREE_W, height,
      marginBottom: 32, flexShrink: 0,
    }}>
      {/* ── SVG edges ── */}
      <svg style={{ position: 'absolute', inset: 0, width: TREE_W, height, pointerEvents: 'none', zIndex: 1 }}>
        {edges.map(e => (
          <path key={e.key} d={e.d} fill="none"
            stroke={e.stroke} strokeWidth={e.width} strokeLinecap="round" />
        ))}
      </svg>

      {/* ── User node ── */}
      {uPos && (
        <TreeNode
          x={uPos.x} y={uPos.y} r={NODE_R[0]}
          c={C.user}
          hovered={hovered?.key === `u:${user.id}`}
          label={user.displayName || user.username}
          sublabel={`@${user.username}`}
          {...makeHover(`u:${user.id}`, 'user', user, uPos.x, uPos.y)}
        >
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            : <span style={{ color: C.user.text, fontWeight: 800, fontSize: 15 }}>
                {(user.displayName || user.username || '?').slice(0, 2).toUpperCase()}
              </span>
          }
        </TreeNode>
      )}

      {/* ── Account / Job / Summary nodes ── */}
      {accs.map(acc => {
        const aPos = pos[`a:${acc.id}`];
        return (
          <TreeNode key={`a:${acc.id}`}
            x={aPos?.x} y={aPos?.y} r={NODE_R[1]}
            c={C.account}
            hovered={hovered?.key === `a:${acc.id}`}
            label={acc.name}
            sublabel={`${(acc.jobs||[]).length} jobs`}
            {...makeHover(`a:${acc.id}`, 'account', acc, aPos?.x, aPos?.y)}
          >
            <Shield size={14} style={{ color: C.account.text }} />
          </TreeNode>
        );
      })}

      {accs.flatMap(acc =>
        (acc.jobs || []).map(job => {
          const jPos = pos[`j:${job.id}:${acc.id}`];
          return (
            <TreeNode key={`j:${job.id}:${acc.id}`}
              x={jPos?.x} y={jPos?.y} r={NODE_R[2]}
              c={C.job}
              hovered={hovered?.key === `j:${job.id}:${acc.id}`}
              label={job.jobName}
              sublabel={job.status}
              {...makeHover(`j:${job.id}:${acc.id}`, 'job', { job, stats: job.stats }, jPos?.x, jPos?.y)}
            >
              <Briefcase size={12} style={{ color: C.job.text }} />
            </TreeNode>
          );
        })
      )}

      {accs.flatMap(acc =>
        (acc.jobs || []).flatMap(job =>
          ['submitted', 'approved', 'rejected'].map(type => {
            const sPos = pos[`s:${job.id}:${acc.id}:${type}`];
            const stats = job.stats?.[type] || { count: 0, cost: null };
            const Icon = SUM_ICONS[type];
            return (
              <TreeNode key={`s:${job.id}:${acc.id}:${type}`}
                x={sPos?.x} y={sPos?.y} r={NODE_R[3]}
                c={C[type]}
                hovered={hovered?.key === `s:${job.id}:${acc.id}:${type}`}
                label={`${stats.count ?? 0}`}
                sublabel={fmtMoney(stats.cost) || type.slice(0, 3)}
                labelColor={C[type].text}
                {...makeHover(`s:${job.id}:${acc.id}:${type}`, 'summary',
                  { sumType: type, stats, job }, sPos?.x, sPos?.y)}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <Icon size={9} style={{ color: C[type].text, opacity: 0.75 }} />
                  <span style={{ color: C[type].text, fontWeight: 800, fontSize: 12, lineHeight: 1 }}>
                    {stats.count ?? 0}
                  </span>
                </div>
              </TreeNode>
            );
          })
        )
      )}

      {/* ── Popover ── */}
      {hovered && (
        <div style={{
          position: 'absolute',
          left: popoverStyle.left,
          top: popoverStyle.top,
          width: popW,
          background: 'rgba(2,12,6,0.97)',
          border: '1px solid rgba(74,222,128,0.18)',
          borderRadius: 12,
          padding: '12px 14px',
          zIndex: 200,
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.75), 0 0 0 1px rgba(74,222,128,0.06)',
          backdropFilter: 'blur(10px)',
          animation: 'treePopIn 0.12s ease',
        }}>
          <PopoverInner type={hovered.type} data={hovered.data} />
        </div>
      )}
    </div>
  );
}

// ─── Generic tree node circle ─────────────────────────────────────────────────

function TreeNode({ x, y, r, c, children, label, sublabel, labelColor, hovered, onMouseEnter, onMouseLeave }) {
  if (x == null || y == null) return null;

  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2 + 30,
        zIndex: hovered ? 10 : 2,
        cursor: 'pointer',
      }}
    >
      {/* Circle */}
      <div style={{
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: c.bg,
        border: `2px solid ${hovered ? c.ring.replace('0.7', '1').replace('0.75', '1').replace('0.65', '1').replace('0.6', '0.95') : c.ring}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        transition: 'transform 0.14s ease, box-shadow 0.14s ease',
        transform: hovered ? 'scale(1.12)' : 'scale(1)',
        boxShadow: hovered
          ? `0 0 0 3px ${c.bg}, 0 0 18px ${c.glow}`
          : `0 0 6px rgba(0,0,0,0.4)`,
      }}>
        {children}
      </div>

      {/* Label */}
      <div style={{
        position: 'absolute',
        top: r * 2 + 3,
        left: '50%',
        transform: 'translateX(-50%)',
        textAlign: 'center',
        width: 'max-content',
        maxWidth: 78,
        pointerEvents: 'none',
      }}>
        {label != null && (
          <div style={{
            color: labelColor || c.text,
            fontSize: 9,
            fontWeight: 700,
            lineHeight: 1.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 78,
            opacity: hovered ? 1 : 0.85,
          }}>
            {label}
          </div>
        )}
        {sublabel != null && (
          <div style={{
            color: 'rgba(134,239,172,0.38)',
            fontSize: 8,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 78,
            marginTop: 1,
          }}>
            {sublabel}
          </div>
        )}
      </div>
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
    setLoading(true);
    setError('');
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
          from { opacity: 0; transform: scale(0.92) translateY(-4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
      `}</style>

      <DateRangeBar range={range} onChange={setRange} />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <Loader size={28} className="animate-spin" style={{ color: '#4ade80' }} />
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
          borderRadius: 12, background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.25)' }}>
          <AlertCircle size={16} style={{ color: '#f87171' }} />
          <span style={{ color: '#fca5a5', fontSize: 13 }}>{error}</span>
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(134,239,172,0.35)', fontSize: 13 }}>
          No members yet.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: TREE_W + 40, paddingBottom: 16 }}>
            {users.map((u, i) => (
              <div key={u.id}>
                {i > 0 && (
                  <div style={{
                    height: 1, background: 'rgba(74,222,128,0.07)',
                    marginBottom: 20, marginTop: -12,
                  }} />
                )}
                <UserTree user={u} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
