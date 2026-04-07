'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function band(s) {
  return s >= 91 ? 'EXCELLENT' : s >= 76 ? 'VERY GOOD' : s >= 61 ? 'GOOD' : s >= 41 ? 'FAIR' : 'POOR';
}

function bar(pts, max) {
  const filled = max > 0 ? Math.round((pts / max) * 10) : 0;
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function row(label, pts, max, extra) {
  return `  ${label.padEnd(14)} [${String(pts).padStart(2)}/${max}]  ${bar(pts, max)}  ${extra}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// REPO SCORE  (0–100)
// Sections: Community Traction (28) | Health & Maintenance (27) |
//           Development Activity (20) | Project Standards (15) | Engagement (10)
// ─────────────────────────────────────────────────────────────────────────────

function scoreRepo(ri) {
  if (!ri) return { score: 0, report: 'No repository data available.', breakdown: {} };

  const bk = {};
  let total = 0;

  // ── Section 1: Community Traction (28) ──────────────────────────────────────
  const stars = ri.stars ?? 0;
  const starPts =
    stars >= 10000 ? 15 : stars >= 5000 ? 13 : stars >= 1000 ? 11 :
    stars >= 500   ?  9 : stars >= 100  ?  7 : stars >= 50   ?  5 :
    stars >= 10    ?  3 : stars >= 1    ?  1 : 0;
  bk.stars = { pts: starPts, max: 15, value: stars };
  total += starPts;

  const forks = ri.forks ?? 0;
  const forkPts =
    forks >= 500 ? 8 : forks >= 100 ? 6 : forks >= 50 ? 5 :
    forks >= 10  ? 3 : forks >= 1   ? 1 : 0;
  bk.forks = { pts: forkPts, max: 8, value: forks };
  total += forkPts;

  const watchers = ri.watchers ?? 0;
  const watchPts =
    watchers >= 1000 ? 5 : watchers >= 500 ? 4 : watchers >= 100 ? 3 :
    watchers >= 20   ? 2 : watchers >= 5   ? 1 : 0;
  bk.watchers = { pts: watchPts, max: 5, value: watchers };
  total += watchPts;

  // ── Section 2: Health & Maintenance (27) ─────────────────────────────────────
  let recencyPts = 0, recencyDays = null;
  if (ri.lastPushedAt) {
    recencyDays = Math.floor((Date.now() - new Date(ri.lastPushedAt)) / 86400000);
    recencyPts =
      recencyDays <= 7   ? 12 : recencyDays <= 30  ? 11 : recencyDays <= 60  ? 9 :
      recencyDays <= 90  ?  7 : recencyDays <= 180 ?  5 : recencyDays <= 365 ? 3 :
      recencyDays <= 730 ?  1 : 0;
  }
  bk.recency = { pts: recencyPts, max: 12, days: recencyDays };
  total += recencyPts;

  const archivedPts = ri.isArchived ? 0 : 5;
  bk.archived = { pts: archivedPts, max: 5, isArchived: !!ri.isArchived };
  total += archivedPts;

  let agePts = 0, ageMonths = null;
  if (ri.createdAt) {
    ageMonths = Math.floor((Date.now() - new Date(ri.createdAt)) / (86400000 * 30));
    agePts = ageMonths >= 48 ? 5 : ageMonths >= 24 ? 4 : ageMonths >= 12 ? 3 : ageMonths >= 6 ? 2 : 1;
  }
  bk.age = { pts: agePts, max: 5, months: ageMonths };
  total += agePts;

  const openIssues = ri.openIssues ?? 0;
  const contribs   = Math.max(ri.contributorCount ?? 1, 1);
  const issueRatio = openIssues / contribs;
  const issueHealthPts =
    openIssues === 0 ? 4 :
    issueRatio < 5   ? 5 : issueRatio < 15 ? 4 : issueRatio < 30 ? 3 :
    issueRatio < 50  ? 2 : 1;
  bk.issueHealth = { pts: issueHealthPts, max: 5, openIssues, contribs, ratio: +issueRatio.toFixed(1) };
  total += issueHealthPts;

  // ── Section 3: Development Activity (20) ─────────────────────────────────────
  const contribPts =
    contribs >= 51 ? 12 : contribs >= 21 ? 10 : contribs >= 11 ? 8 :
    contribs >= 6  ?  6 : contribs >= 4  ?  4 : contribs >= 2  ? 2 : 0;
  bk.contributors = { pts: contribPts, max: 12, value: ri.contributorCount ?? 0 };
  total += contribPts;

  let networkPts = 2;
  if (ri.networkCount != null && forks > 0) {
    const nr = ri.networkCount / forks;
    networkPts = nr >= 3 ? 5 : nr >= 2 ? 4 : nr >= 1.5 ? 3 : 2;
  }
  bk.networkEffect = { pts: networkPts, max: 5, network: ri.networkCount, forks };
  total += networkPts;

  const topicCount = ri.topics?.length ?? 0;
  const topicPts   = topicCount >= 6 ? 3 : topicCount >= 3 ? 2 : topicCount >= 1 ? 1 : 0;
  bk.topics = { pts: topicPts, max: 3, count: topicCount, list: ri.topics ?? [] };
  total += topicPts;

  // ── Section 4: Project Standards (15) ────────────────────────────────────────
  const lic    = (ri.license || '').toLowerCase();
  const licPts =
    /mit|apache|bsd|isc/.test(lic)    ? 5 :
    /gpl|lgpl|mozilla|eupl/.test(lic) ? 4 :
    lic && lic !== 'none'             ? 3 : 0;
  bk.license = { pts: licPts, max: 5, value: ri.license || 'None' };
  total += licPts;

  const sizeMb   = (ri.sizeKb ?? 0) / 1024;
  const sizePts  =
    sizeMb > 200  ? 0 :
    sizeMb > 100  ? 4 :
    sizeMb > 20   ? 5 :
    sizeMb > 5    ? 4 :
    sizeMb > 0.5  ? 3 : 1;
  bk.size = { pts: sizePts, max: 5, mb: +sizeMb.toFixed(1) };
  total += sizePts;

  const lang    = ri.primaryLanguage || '';
  const langPts =
    ['JavaScript', 'TypeScript', 'Python'].includes(lang) ? 5 :
    ['CoffeeScript', 'Vue', 'Svelte', 'Astro'].includes(lang) ? 3 :
    lang ? 2 : 1;
  bk.language = { pts: langPts, max: 5, value: lang || 'Unknown' };
  total += langPts;

  // ── Section 5: Engagement Depth (10) ─────────────────────────────────────────
  let engPts = 2;
  if (stars > 0) {
    const fr = forks / stars;
    engPts = (fr >= 0.05 && fr <= 0.35) ? 5 : fr < 0.05 ? 3 : 2;
  }
  bk.forkEngagement = { pts: engPts, max: 5, ratio: stars > 0 ? +(forks / stars).toFixed(3) : null };
  total += engPts;

  const descPts = ri.description ? 2 : 0;
  bk.description = { pts: descPts, max: 2, present: !!ri.description };
  total += descPts;

  const homePts = ri.homepage ? 3 : 0;
  bk.homepage = { pts: homePts, max: 3, present: !!ri.homepage };
  total += homePts;

  const score  = Math.min(100, Math.max(0, Math.round(total)));
  const report = buildRepoReport(score, bk, ri);
  return { score, report, breakdown: bk };
}

// ─────────────────────────────────────────────────────────────────────────────
// ISSUE SCORE  (0–100)
// Sections: Code Change Complexity (35) | Discussion & Community (30) |
//           Issue Quality Signals (20) | Change Quality Signals (15)
// ─────────────────────────────────────────────────────────────────────────────

function scoreIssue(issue) {
  if (!issue) return { score: 0, report: 'No issue data available.', breakdown: {} };

  const bk = {};
  let total = 0;

  // ── Section 1: Code Change Complexity (35) ───────────────────────────────────
  const fileCount = issue.filesChanged?.length ?? 0;
  const filePts   =
    fileCount === 0  ?  0 :
    fileCount === 1  ?  3 :
    fileCount === 2  ?  5 :
    fileCount <= 5   ?  9 :
    fileCount <= 15  ? 13 :
    fileCount <= 30  ? 15 : 10;   // 31+ likely mass refactor
  bk.filesChanged = { pts: filePts, max: 15, count: fileCount };
  total += filePts;

  const linesAdded   = issue.linesAdded   ?? 0;
  const linesDeleted = issue.linesDeleted ?? 0;
  const totalLines   = linesAdded + linesDeleted;
  const linesPts =
    totalLines < 20   ?  0 :   // below minimum threshold
    totalLines < 50   ?  3 :
    totalLines < 150  ?  6 :
    totalLines < 500  ?  9 :
    totalLines < 1000 ? 11 : 12;
  bk.linesChanged = { pts: linesPts, max: 12, total: totalLines, added: linesAdded, deleted: linesDeleted };
  total += linesPts;

  const commits    = issue.commitCount ?? 0;
  const commitPts  =
    commits === 0 ? 0 : commits === 1 ? 1 : commits === 2 ? 3 :
    commits <= 5  ? 5 : commits <= 10 ? 7 : 8;
  bk.commits = { pts: commitPts, max: 8, value: commits };
  total += commitPts;

  // ── Section 2: Discussion & Community (30) ───────────────────────────────────
  const discCount = issue.discussionCount ?? 0;
  const discPts   =
    discCount === 0  ? 0 : discCount <= 2  ? 3 : discCount <= 5  ? 6 :
    discCount <= 10  ? 8 : discCount <= 20 ? 9 : 10;
  bk.discussions = { pts: discPts, max: 10, count: discCount };
  total += discPts;

  const chars    = issue.discussionCharCount ?? 0;
  const charPts  =
    chars < 100   ? 0 : chars < 500   ? 2 : chars < 2000  ? 4 :
    chars < 5000  ? 6 : chars < 10000 ? 7 : 8;
  bk.discussionDepth = { pts: charPts, max: 8, chars };
  total += charPts;

  const codePct  = issue.discussionCodePercent ?? 0;
  const codePts  =
    codePct === 0 ? 0 : codePct < 5  ? 1 : codePct < 15 ? 2 :
    codePct < 30  ? 3 : codePct < 50 ? 4 : 5;
  bk.codeInDiscussions = { pts: codePts, max: 5, percent: codePct };
  total += codePts;

  const participants    = issue.participantCount ?? 0;
  const participantPts  =
    participants <= 1 ? 1 : participants === 2 ? 3 : participants <= 5  ? 5 :
    participants <= 10 ? 6 : 7;
  bk.participants = { pts: participantPts, max: 7, count: participants };
  total += participantPts;

  // ── Section 3: Issue Quality Signals (20) ────────────────────────────────────
  let durationPts = 4;
  if (issue.issueDurationMs != null) {
    const days = issue.issueDurationMs / 86400000;
    durationPts =
      days < 1     ? 0 : days < 7    ? 3 : days <= 30  ? 6 :
      days <= 90   ? 8 : days <= 365 ? 7 : days <= 730 ? 6 : 4;
  }
  bk.duration = { pts: durationPts, max: 8, ms: issue.issueDurationMs };
  total += durationPts;

  const labels  = issue.labels ?? [];
  const labStr  = labels.join(' ').toLowerCase();
  let labelPts  = 2;
  if (labels.length > 0) {
    const hasBad     = /\b(doc|docs|documentation|css|style|typo|chore|meta)\b/.test(labStr);
    const hasTrivial = /\b(easy|beginner|good.first.issue|starter|simple|trivial)\b/.test(labStr);
    const hasComplex = /\b(complex|hard|difficult|investigation|major|critical|security|performance|regression|p0|p1)\b/.test(labStr);
    const hasGood    = /\b(bug|fix|feature|enhancement|improvement|defect|crash)\b/.test(labStr);
    labelPts = hasComplex ? 7 : (hasGood && !hasBad) ? 5 : hasBad ? 0 : hasTrivial ? 1 : 3;
  }
  bk.labels = { pts: labelPts, max: 7, list: labels };
  total += labelPts;

  const titleLen  = (issue.issueTitle || '').trim().length;
  const titlePts  =
    titleLen < 10 ? 0 : titleLen < 20 ? 1 : titleLen < 40 ? 3 :
    titleLen < 80 ? 5 : 3;
  bk.titleQuality = { pts: titlePts, max: 5, length: titleLen };
  total += titlePts;

  // ── Section 4: Change Quality Signals (15) ───────────────────────────────────
  let balancePts = 3;
  if (totalLines > 0) {
    const ar = linesAdded / totalLines;
    balancePts = (ar >= 0.25 && ar <= 0.75) ? 8 : (ar >= 0.1 || ar <= 0.9) ? 5 : 2;
  }
  bk.linesBalance = {
    pts: balancePts, max: 8,
    addRatio: totalLines > 0 ? +(linesAdded / totalLines).toFixed(2) : null,
  };
  total += balancePts;

  const hasTests = (issue.filesChanged || []).some(f =>
    /test[s]?[/_.]|\.test\.|\.spec\.|__test__|_test\b/i.test(f)
  );
  bk.testFiles = { pts: hasTests ? 4 : 0, max: 4, present: hasTests };
  total += bk.testFiles.pts;

  const dirs      = new Set((issue.filesChanged || []).map(f => f.includes('/') ? f.split('/')[0] : '_root'));
  const spreadPts = dirs.size >= 3 ? 3 : dirs.size === 2 ? 2 : dirs.size === 1 ? 1 : 0;
  bk.codeSpread = { pts: spreadPts, max: 3, dirs: dirs.size };
  total += spreadPts;

  const score  = Math.min(100, Math.max(0, Math.round(total)));
  const report = buildIssueReport(score, bk, issue);
  return { score, report, breakdown: bk };
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

function buildRepoReport(score, bk, ri) {
  const L = [];
  L.push(`REPO ASSESSMENT: ${score}/100 — ${band(score)}`);
  L.push('═'.repeat(62));
  L.push('');

  // S1
  const s1 = bk.stars.pts + bk.forks.pts + bk.watchers.pts;
  L.push(`SECTION 1 · Community Traction  [${s1}/28]`);
  L.push(row('Stars',    bk.stars.pts,    15, `${bk.stars.value.toLocaleString()} stars`));
  if (bk.stars.value >= 10000) L.push('    → World-class recognition. Top-tier open-source project.');
  else if (bk.stars.value >= 1000) L.push('    → Strong adoption. Well-known within its ecosystem.');
  else if (bk.stars.value >= 100) L.push('    → Moderate recognition. Growing community.');
  else if (bk.stars.value >= 10) L.push('    → Limited stars. Niche or early-stage project.');
  else L.push('    → Very few stars. Unknown or brand-new project.');
  L.push(row('Forks',    bk.forks.pts,    8,  `${bk.forks.value.toLocaleString()} forks`));
  if (bk.forks.value >= 500) L.push('    → High fork activity. Widely used as a base for derivative projects.');
  else if (bk.forks.value >= 100) L.push('    → Good fork count. Active community building on this codebase.');
  else if (bk.forks.value >= 10) L.push('    → Moderate forks. Some derivative projects exist.');
  else L.push('    → Low fork activity.');
  L.push(row('Watchers', bk.watchers.pts, 5,  `${bk.watchers.value.toLocaleString()} subscribers`));
  if (bk.watchers.value >= 1000) L.push('    → Very high watcher count. Large engaged audience tracking changes.');
  else if (bk.watchers.value >= 100) L.push('    → Good watcher base. Active interest in project updates.');
  else L.push('    → Low subscriber count.');
  L.push('');

  // S2
  const s2 = bk.recency.pts + bk.archived.pts + bk.age.pts + bk.issueHealth.pts;
  L.push(`SECTION 2 · Health & Maintenance  [${s2}/27]`);
  L.push(row('Recency',   bk.recency.pts,     12, bk.recency.days != null ? `${bk.recency.days}d since last push` : 'Unknown'));
  if (bk.recency.days != null) {
    if (bk.recency.days <= 7)   L.push('    → Actively maintained this week. Excellent responsiveness.');
    else if (bk.recency.days <= 30)  L.push('    → Recent activity within last month. Healthy maintenance cadence.');
    else if (bk.recency.days <= 90)  L.push('    → Moderate activity. Some lag since last update.');
    else if (bk.recency.days <= 365) L.push('    → Infrequent updates. Possibly in low-maintenance mode.');
    else L.push('    → No activity for over a year. High abandonment risk.');
  }
  L.push(row('Archived',  bk.archived.pts,    5,  bk.archived.isArchived ? 'ARCHIVED — read-only' : 'Active'));
  if (bk.archived.isArchived) L.push('    → CRITICAL: Repository is archived. No further development expected.');
  L.push(row('Longevity', bk.age.pts,         5,  bk.age.months != null ? `${bk.age.months} months old` : 'Unknown'));
  if (bk.age.months != null) {
    if (bk.age.months >= 48) L.push('    → Mature, established project. 4+ years of proven track record.');
    else if (bk.age.months >= 24) L.push('    → Well-established. 2+ years of development history.');
    else if (bk.age.months >= 12) L.push('    → Approaching maturity. Over a year of history.');
    else L.push('    → Relatively new project. Less than a year of history.');
  }
  L.push(row('IssueRatio', bk.issueHealth.pts, 5, `${bk.issueHealth.openIssues} open / ${bk.issueHealth.contribs} contributors = ${bk.issueHealth.ratio}x`));
  if (bk.issueHealth.ratio < 5)  L.push('    → Excellent issue management per contributor. Well-handled backlog.');
  else if (bk.issueHealth.ratio < 15) L.push('    → Manageable issue load. Team keeping up reasonably well.');
  else if (bk.issueHealth.ratio < 30) L.push('    → Elevated issue density. Maintainers may be stretched.');
  else L.push('    → High open-issue backlog relative to contributors. Overwhelmed maintenance team.');
  L.push('');

  // S3
  const s3 = bk.contributors.pts + bk.networkEffect.pts + bk.topics.pts;
  L.push(`SECTION 3 · Development Activity  [${s3}/20]`);
  L.push(row('Contributors', bk.contributors.pts,  12, `${bk.contributors.value} contributors`));
  if (bk.contributors.value >= 51) L.push('    → Large contributor base. Strong bus-factor. Truly community-driven.');
  else if (bk.contributors.value >= 21) L.push('    → Good team size. Healthy contributor diversity.');
  else if (bk.contributors.value >= 11) L.push('    → Medium team. Some contributor diversity.');
  else if (bk.contributors.value >= 4)  L.push('    → Small team. Limited contributor diversity.');
  else if (bk.contributors.value >= 2)  L.push('    → Very small team. High single-person dependency risk.');
  else L.push('    → Solo project. Maximum bus-factor risk. Entire codebase on one person.');
  L.push(row('Network',     bk.networkEffect.pts, 5,  `${bk.networkEffect.network ?? 'N/A'} network forks`));
  if (bk.networkEffect.network != null && bk.networkEffect.forks > 0) {
    const nr = (bk.networkEffect.network / bk.networkEffect.forks).toFixed(1);
    if (nr >= 2) L.push(`    → Strong downstream ecosystem (${nr}x multiplier). Many derivative projects built on this.`);
    else L.push('    → Moderate network effect. Some downstream usage.');
  }
  L.push(row('Topics',      bk.topics.pts,        3,  `${bk.topics.count} topic(s)${bk.topics.list.length ? ': ' + bk.topics.list.slice(0, 5).join(', ') : ''}`));
  if (bk.topics.count === 0) L.push('    → No topics defined. Reduces discoverability and signals less attention to detail.');
  L.push('');

  // S4
  const s4 = bk.license.pts + bk.size.pts + bk.language.pts;
  L.push(`SECTION 4 · Project Standards  [${s4}/15]`);
  L.push(row('License',  bk.license.pts,  5, bk.license.value));
  if (bk.license.pts === 0) L.push('    → No license. Legal ambiguity. Cannot be used in many contexts. Significant risk.');
  else if (bk.license.pts === 5) L.push('    → Permissive license (MIT/Apache/BSD). Maximum compatibility and reusability.');
  else if (bk.license.pts === 4) L.push('    → Copyleft license (GPL/LGPL). Usable but requires attention to license terms.');
  else L.push('    → Custom or less common license. Verify compatibility for use case.');
  L.push(row('Size',     bk.size.pts,     5, `${bk.size.mb} MB`));
  if (bk.size.mb > 200) L.push('    → EXCEEDS 200 MB requirement. Repository is too large for reliable processing.');
  else if (bk.size.mb > 20) L.push('    → Optimal size range. Substantial codebase, manageable for tooling.');
  else if (bk.size.mb > 5) L.push('    → Good size. Adequate codebase for meaningful issues.');
  else L.push('    → Small repository. May lack complexity needed for challenging issues.');
  L.push(row('Language', bk.language.pts, 5, bk.language.value));
  if (bk.language.pts === 5) L.push(`    → Primary language (${bk.language.value}) in our supported tier (Python, JavaScript, TypeScript).`);
  else if (bk.language.pts >= 3) L.push('    → Adjacent language to supported tier. Partial tooling support.');
  else L.push('    → Primary language not in supported tier. Tooling may be limited.');
  L.push('');

  // S5
  const s5 = bk.forkEngagement.pts + bk.description.pts + bk.homepage.pts;
  L.push(`SECTION 5 · Engagement Depth  [${s5}/10]`);
  L.push(row('Fork/Star',   bk.forkEngagement.pts, 5, `Ratio: ${bk.forkEngagement.ratio ?? 'N/A'}`));
  if (bk.forkEngagement.pts >= 5) L.push(`    → Healthy fork/star ratio. Community actively extends rather than just appreciating.`);
  else L.push('    → Fork/star ratio outside healthy range. More passive appreciation than active building.');
  L.push(row('Description', bk.description.pts,    2, bk.description.present ? 'Present' : 'Missing'));
  L.push(row('Homepage',    bk.homepage.pts,        3, bk.homepage.present ? 'Documented site present' : 'Not set'));
  L.push('');

  // Overall
  L.push('─'.repeat(62));
  L.push(`OVERALL SCORE: ${score}/100 — ${band(score)}`);
  L.push('');
  if (score >= 91)      L.push('Outstanding repository. Highly active, well-maintained project with exceptional community traction. Excellent source for complex, meaningful issues.');
  else if (score >= 76) L.push('Strong repository. Active development, good community, and solid standards. High-quality source for challenging issues.');
  else if (score >= 61) L.push('Good repository. Meets core requirements with some areas for concern. Suitable for finding meaningful issues.');
  else if (score >= 41) L.push('Fair repository. Notable weaknesses in activity, community, or standards. Use with caution.');
  else                  L.push('Poor repository. Significant concerns across multiple dimensions. High risk of low-value or unstable issues.');

  const concerns = [];
  if (bk.archived.isArchived)   concerns.push('Repository is ARCHIVED — no active development');
  if (bk.size.mb > 200)         concerns.push(`Size (${bk.size.mb} MB) exceeds 200 MB limit`);
  if (bk.contributors.value <= 1) concerns.push('Solo contributor — high bus-factor risk');
  if (bk.recency.days > 730)    concerns.push('No commits in 2+ years — likely abandoned');
  if (bk.license.pts === 0)     concerns.push('No license — legal ambiguity');
  if (concerns.length) { L.push(''); L.push('⚠ KEY CONCERNS:'); concerns.forEach(c => L.push(`  • ${c}`)); }

  return L.join('\n');
}

function buildIssueReport(score, bk, issue) {
  const L = [];
  L.push(`ISSUE ASSESSMENT: ${score}/100 — ${band(score)}`);
  L.push('═'.repeat(62));
  L.push('');
  const totalLines = bk.linesChanged.total;

  // S1
  const s1 = bk.filesChanged.pts + bk.linesChanged.pts + bk.commits.pts;
  L.push(`SECTION 1 · Code Change Complexity  [${s1}/35]`);
  L.push(row('Files',   bk.filesChanged.pts, 15, `${bk.filesChanged.count} file(s) changed`));
  if (bk.filesChanged.count === 0)   L.push('    → No file data. Cannot assess change scope.');
  else if (bk.filesChanged.count === 1) L.push('    → Single-file change. Likely a simple, contained fix.');
  else if (bk.filesChanged.count <= 5)  L.push('    → Moderate scope. Touches multiple files — indicates real complexity.');
  else if (bk.filesChanged.count <= 15) L.push('    → Wide impact. Change spans significant portions of the codebase.');
  else if (bk.filesChanged.count <= 30) L.push('    → Large scope. Extensive modification across many files.');
  else L.push(`    → Very large scope (${bk.filesChanged.count} files). Risk of bulk refactor rather than focused fix.`);

  L.push(row('Lines',   bk.linesChanged.pts, 12, `+${bk.linesChanged.added} / -${bk.linesChanged.deleted} = ${totalLines} total`));
  if (totalLines < 20)   L.push('    → BELOW minimum threshold (20 lines). Issue is too small per requirements.');
  else if (totalLines < 50)   L.push(`    → Small change (${totalLines} lines). Borderline complexity.`);
  else if (totalLines < 150)  L.push(`    → Moderate change. Adequate for a meaningful fix.`);
  else if (totalLines < 500)  L.push(`    → Substantial change. Real implementation work required.`);
  else L.push(`    → Large change (${totalLines.toLocaleString()} lines). Complex implementation, possibly broad impact.`);

  L.push(row('Commits', bk.commits.pts, 8, `${bk.commits.value} commit(s)`));
  if (bk.commits.value <= 1)  L.push('    → Single-commit fix. Suggests non-iterative, straightforward solution.');
  else if (bk.commits.value <= 2) L.push('    → Minimal commits. Some iteration but limited.');
  else if (bk.commits.value <= 5) L.push('    → Multiple commits. Demonstrates iterative development process.');
  else if (bk.commits.value <= 10) L.push('    → Many commits. Clear evidence of incremental, careful development.');
  else L.push(`    → High commit count (${bk.commits.value}). Extensive iteration — complex or exploratory fix.`);
  L.push('');

  // S2
  const s2 = bk.discussions.pts + bk.discussionDepth.pts + bk.codeInDiscussions.pts + bk.participants.pts;
  L.push(`SECTION 2 · Discussion & Community  [${s2}/30]`);
  L.push(row('Comments',    bk.discussions.pts,       10, `${bk.discussions.count} comment(s)`));
  if (bk.discussions.count === 0)   L.push('    → No discussion. Issue resolved without community input or explanation.');
  else if (bk.discussions.count <= 2) L.push('    → Minimal discussion. Quick resolution with little back-and-forth.');
  else if (bk.discussions.count <= 10) L.push('    → Good discussion activity. Community engaged in problem-solving.');
  else L.push(`    → Extensive discussion (${bk.discussions.count} comments). Complex, contested, or important issue.`);

  L.push(row('Disc.Depth',  bk.discussionDepth.pts,   8,  `${bk.discussionDepth.chars.toLocaleString()} chars`));
  if (bk.discussionDepth.chars < 100) L.push('    → Near-empty discussion. Issue lacks technical depth.');
  else if (bk.discussionDepth.chars < 2000) L.push('    → Brief discussion. Some context but not deeply explored.');
  else if (bk.discussionDepth.chars < 10000) L.push('    → Rich discussion. Significant technical detail and context.');
  else L.push(`    → Very deep discussion (${(bk.discussionDepth.chars/1000).toFixed(0)}k chars). Extensive technical exploration.`);

  L.push(row('Code%',       bk.codeInDiscussions.pts, 5,  `${bk.codeInDiscussions.percent}% code in discussion`));
  if (bk.codeInDiscussions.percent === 0) L.push('    → No code snippets. Text-only discussion — less technical verification.');
  else if (bk.codeInDiscussions.percent < 15) L.push('    → Some code in discussion. Provides technical context.');
  else L.push(`    → High code density (${bk.codeInDiscussions.percent}%). Technical discussion with examples, patches, or reproductions.`);

  L.push(row('Participants', bk.participants.pts,      7,  `${bk.participants.count} unique participant(s)`));
  if (bk.participants.count <= 1) L.push('    → Single participant. No community involvement.');
  else if (bk.participants.count <= 2) L.push('    → Two participants. Reporter + one other.');
  else if (bk.participants.count <= 5) L.push('    → Good engagement. Multiple community members involved.');
  else L.push(`    → High participation (${bk.participants.count}). Issue has broad community relevance.`);
  L.push('');

  // S3
  const s3 = bk.duration.pts + bk.labels.pts + bk.titleQuality.pts;
  L.push(`SECTION 3 · Issue Quality Signals  [${s3}/20]`);
  const durDays = bk.duration.ms != null ? (bk.duration.ms / 86400000).toFixed(1) : null;
  L.push(row('Duration',    bk.duration.pts,     8, durDays != null ? `${durDays} days open` : 'Still open'));
  if (bk.duration.ms == null) L.push('    → Issue is still open. Ongoing relevance confirmed.');
  else if (bk.duration.ms < 86400000) L.push('    → Resolved in under a day. Trivially fast — suggests very simple fix.');
  else if (bk.duration.ms < 7 * 86400000) L.push(`    → Resolved in ${durDays} days. Quick but not trivial.`);
  else if (bk.duration.ms < 30 * 86400000) L.push(`    → Resolved in ${Math.round(bk.duration.ms/86400000)} days. Good resolution timeline.`);
  else if (bk.duration.ms < 90 * 86400000) L.push(`    → Open for ${Math.round(bk.duration.ms/86400000)} days. Well-considered, non-trivial issue.`);
  else L.push(`    → Long-standing issue (${Math.round(bk.duration.ms/86400000/30)} months). Complex, difficult, or deprioritized.`);

  L.push(row('Labels',      bk.labels.pts,       7, bk.labels.list.length ? bk.labels.list.join(', ') : 'None'));
  if (!bk.labels.list.length) L.push('    → No labels. Cannot assess issue type from metadata alone.');
  else if (bk.labels.pts === 7) L.push('    → Labels indicate HIGH complexity (critical/security/performance/regression). Top-tier issue.');
  else if (bk.labels.pts >= 5) L.push('    → Labels confirm solid issue type (bug/feature/enhancement). Good candidate.');
  else if (bk.labels.pts === 0) L.push('    → Labels suggest documentation/CSS/chore change. Likely excluded per requirements.');
  else if (bk.labels.pts === 1) L.push('    → Labeled as easy/good-first-issue. Below required complexity level.');

  L.push(row('Title',       bk.titleQuality.pts, 5, `${bk.titleQuality.length} characters`));
  if (bk.titleQuality.length < 10) L.push('    → Very short title. Issue is vaguely described.');
  else if (bk.titleQuality.length < 40) L.push('    → Brief title. Some specificity but could be more descriptive.');
  else L.push('    → Good title length. Sufficiently descriptive problem statement.');
  L.push('');

  // S4
  const s4 = bk.linesBalance.pts + bk.testFiles.pts + bk.codeSpread.pts;
  L.push(`SECTION 4 · Change Quality Signals  [${s4}/15]`);
  const ar = bk.linesBalance.addRatio;
  L.push(row('Balance',  bk.linesBalance.pts, 8, ar != null ? `${(ar*100).toFixed(0)}% added / ${((1-ar)*100).toFixed(0)}% deleted` : 'N/A'));
  if (ar != null) {
    if (bk.linesBalance.pts >= 8) L.push('    → Healthy add/delete mix. Real feature or fix work — not a pure refactor.');
    else if (bk.linesBalance.pts >= 5) L.push(`    → Somewhat unbalanced. Skewed toward ${ar > 0.75 ? 'additions' : 'deletions'}.`);
    else L.push(`    → Heavily skewed (${ar > 0.5 ? 'mostly additions — possible feature bloat' : 'mostly deletions — likely pure refactor'}). Verify against requirements.`);
  }

  L.push(row('Tests',    bk.testFiles.pts,    4, bk.testFiles.present ? 'Test file(s) present in change' : 'No test files detected'));
  if (bk.testFiles.present) L.push('    → Test files modified/added. Fix naturally includes tests as required.');
  else L.push('    → No test files in change. Verify if issue naturally requires tests elsewhere.');

  L.push(row('Spread',   bk.codeSpread.pts,   3, `${bk.codeSpread.dirs} top-level director${bk.codeSpread.dirs !== 1 ? 'ies' : 'y'}`));
  if (bk.codeSpread.dirs >= 3) L.push('    → Cross-cutting concern. Change spans multiple parts of codebase.');
  else if (bk.codeSpread.dirs === 2) L.push('    → Change touches two areas. Moderate scope.');
  else L.push('    → Single-directory change. Contained within one area.');
  L.push('');

  // Overall
  L.push('─'.repeat(62));
  L.push(`OVERALL SCORE: ${score}/100 — ${band(score)}`);
  L.push('');
  if (score >= 91)      L.push('Excellent issue. Rich discussion, significant code change, broad scope, and test coverage. Ideal candidate.');
  else if (score >= 76) L.push('Strong issue. Meaningful complexity, good community engagement, and solid code changes. Highly recommended.');
  else if (score >= 61) L.push('Good issue. Meets most requirements. Suitable with minor reservations.');
  else if (score >= 41) L.push('Fair issue. Some value but notable gaps in complexity, discussion, or quality signals. Review carefully.');
  else                  L.push('Poor issue. Multiple critical indicators suggest this is too simple, a pure refactor, or lacks substance.');

  const flags = [];
  if (totalLines < 20)              flags.push('FAIL: Total lines changed < 20 — below minimum complexity threshold');
  if (!bk.testFiles.present)        flags.push('WARN: No test files in change — verify issue naturally requires tests');
  if (bk.commits.value <= 1)        flags.push('WARN: Single commit — may indicate trivial, non-iterative fix');
  if (bk.discussions.count === 0)   flags.push('WARN: Zero discussion — issue may be underspecified or trivial');
  if (bk.labels.pts === 0 && bk.labels.list.length > 0) flags.push('FAIL: Labels indicate doc/CSS/chore — excluded by requirements');
  if (bk.labels.pts === 1)          flags.push('WARN: Labeled easy/good-first-issue — below required complexity');
  if (bk.filesChanged.count > 30)   flags.push('WARN: 30+ files — risk of bulk refactor rather than focused fix');
  if (flags.length) { L.push(''); L.push('⚠ FLAGS:'); flags.forEach(f => L.push(`  • ${f}`)); }

  return L.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = { scoreRepo, scoreIssue };
