'use strict';

const axios = require('axios');
const { scoreRepo, scoreIssue } = require('./scoreAlgorithm');

const GITHUB_API = 'https://api.github.com';

function ghHeaders(token) {
  const h = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'SmartIssueFinder/1.0',
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghGet(url, headers, params = {}) {
  try {
    const r = await axios.get(url, {
      headers,
      params: Object.keys(params).length ? params : undefined,
      timeout: 15000,
      validateStatus: () => true,
    });
    if (r.status === 403 || r.status === 429) {
      return { error: r.data?.message || 'GitHub rate limit exceeded.', rateLimited: true, status: r.status };
    }
    if (r.status === 404) return { error: 'Not found', status: 404 };
    if (r.status < 200 || r.status >= 300) return { error: r.data?.message || 'GitHub API error', status: r.status };
    return { data: r.data, status: r.status, headers: r.headers };
  } catch (e) {
    return { error: e.message || 'Network error', status: 0 };
  }
}

function parseIssueUrl(url) {
  const m = (url || '').match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], issueNumber: m[3], repoFull: `${m[1]}/${m[2]}` };
}

async function getContributorCount(headers, repoFull) {
  const resp = await ghGet(`${GITHUB_API}/repos/${repoFull}/contributors`, headers, { per_page: 1, anon: false });
  if (!resp || resp.status !== 200) return null;
  const link = resp.headers?.link || '';
  const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (m) return parseInt(m[1], 10);
  return Array.isArray(resp.data) ? resp.data.length : null;
}

function analyzeDiscussions(texts) {
  let totalChars = 0;
  let codeChars  = 0;
  for (const text of texts) {
    if (!text) continue;
    totalChars += text.length;
    const withoutFences = text.replace(/```[\s\S]*?```/g, m => { codeChars += m.length; return ''; });
    withoutFences.replace(/`[^`\n]+`/g, m => { codeChars += m.length; });
  }
  return {
    discussionCharCount:   totalChars,
    discussionCodePercent: totalChars > 0 ? Math.round((codeChars / totalChars) * 100) : 0,
  };
}

async function findLinkedPr(headers, repoFull, issueNumber) {
  const tlResp = await ghGet(
    `${GITHUB_API}/repos/${repoFull}/issues/${issueNumber}/timeline`,
    { ...headers, Accept: 'application/vnd.github.mockingbird-preview+json' }
  );
  const prNumbers = [];
  if (tlResp?.status === 200) {
    for (const ev of tlResp.data) {
      if (['cross-referenced', 'closed'].includes(ev.event)) {
        const iss = ev.source?.issue;
        if (iss?.pull_request && iss.number) prNumbers.push(iss.number);
      }
    }
  }
  if (!prNumbers.length) {
    const sr = await ghGet(`${GITHUB_API}/search/issues`, headers, {
      q: `repo:${repoFull} is:pr is:closed ${issueNumber}`, per_page: 10,
    });
    if (sr?.status === 200) {
      for (const item of sr.data.items || []) {
        const body = (item.body || '').toLowerCase();
        if ([`#${issueNumber}`, `fixes #${issueNumber}`, `closes #${issueNumber}`, `resolves #${issueNumber}`]
          .some(r => body.includes(r))) prNumbers.push(item.number);
      }
    }
  }
  const seen = new Set();
  for (const num of prNumbers) {
    if (seen.has(num)) continue; seen.add(num);
    const prResp = await ghGet(`${GITHUB_API}/repos/${repoFull}/pulls/${num}`, headers);
    if (prResp?.status === 200) {
      const pr = prResp.data;
      if (pr.base?.sha && pr.merged_at) {
        return {
          prUrl: pr.html_url, baseSha: pr.base.sha, prNumber: num,
          changedFiles: pr.changed_files || 0, commitCount: pr.commits || 0,
          linesAdded: pr.additions || 0, linesDeleted: pr.deletions || 0,
        };
      }
    }
  }
  return null;
}

/**
 * Fetches all GitHub data for an issue URL, computes scores, and returns a
 * structured object ready to save to GithubIssue.
 *
 * @param {string} issueUrl  - Full GitHub issue URL
 * @param {string} token     - GitHub personal access token (may be empty string)
 * @returns {object}  Full data object on success, or { error, status, rateLimited } on failure
 */
async function fetchIssueDataFromGitHub(issueUrl, token) {
  const parsed = parseIssueUrl(issueUrl);
  if (!parsed) return { error: 'Invalid GitHub issue URL', status: 400 };

  const hdrs = ghHeaders(token);

  // Fetch issue
  const issueResp = await ghGet(`${GITHUB_API}/repos/${parsed.repoFull}/issues/${parsed.issueNumber}`, hdrs);
  if (issueResp.error) return issueResp;
  const issueData = issueResp.data;

  // Fetch repository information
  let repoInfo = null;
  const repoResp = await ghGet(`${GITHUB_API}/repos/${parsed.repoFull}`, hdrs);
  if (repoResp?.status === 200) {
    const r = repoResp.data;
    const contributorCount = await getContributorCount(hdrs, parsed.repoFull);
    repoInfo = {
      description:     r.description       || null,
      stars:           r.stargazers_count   ?? null,
      forks:           r.forks_count        ?? null,
      watchers:        r.subscribers_count  ?? null,
      openIssues:      r.open_issues_count  ?? null,
      primaryLanguage: r.language           || null,
      topics:          Array.isArray(r.topics) ? r.topics : [],
      sizeKb:          r.size               ?? null,
      createdAt:       r.created_at         ? new Date(r.created_at) : null,
      lastPushedAt:    r.pushed_at          ? new Date(r.pushed_at)  : null,
      license:         r.license?.name      || null,
      isArchived:      r.archived           ?? false,
      defaultBranch:   r.default_branch     || null,
      contributorCount,
      htmlUrl:         r.html_url           || null,
      homepage:        r.homepage           || null,
      networkCount:    r.network_count      ?? null,
    };
  }

  // Labels
  const labels = Array.isArray(issueData.labels)
    ? issueData.labels.map(l => (typeof l === 'string' ? l : l.name)).filter(Boolean)
    : [];

  // Discussion count
  const discussionCount = issueData.comments ?? 0;

  // Issue lifecycle
  const issueOpenedAt   = issueData.created_at ? new Date(issueData.created_at) : null;
  const issueClosedAt   = issueData.closed_at  ? new Date(issueData.closed_at)  : null;
  const issueDurationMs = issueOpenedAt && issueClosedAt ? issueClosedAt - issueOpenedAt : null;

  // Fetch comments for discussion analysis + participants
  const commentsResp = await ghGet(
    `${GITHUB_API}/repos/${parsed.repoFull}/issues/${parsed.issueNumber}/comments`,
    hdrs, { per_page: 100 }
  );
  const comments = commentsResp?.status === 200 && Array.isArray(commentsResp.data)
    ? commentsResp.data : [];

  const participantLogins = new Set();
  if (issueData.user?.login) participantLogins.add(issueData.user.login);
  for (const c of comments) { if (c.user?.login) participantLogins.add(c.user.login); }
  const participantCount = participantLogins.size;

  const allTexts = [issueData.body || '', ...comments.map(c => c.body || '')];
  const { discussionCharCount, discussionCodePercent } = analyzeDiscussions(allTexts);

  // Find linked merged PR
  const pr = await findLinkedPr(hdrs, parsed.repoFull, parsed.issueNumber);

  // Fetch changed file paths from PR
  let filesChanged = [];
  if (pr?.prNumber) {
    const filesResp = await ghGet(
      `${GITHUB_API}/repos/${parsed.repoFull}/pulls/${pr.prNumber}/files`, hdrs, { per_page: 100 }
    );
    if (filesResp?.status === 200 && Array.isArray(filesResp.data)) {
      filesChanged = filesResp.data.map(f => f.filename);
    }
  }

  // Compute scores
  const repoAssessment  = scoreRepo(repoInfo);
  const issueAssessment = scoreIssue({
    filesChanged,
    commitCount:           pr?.commitCount   ?? null,
    linesAdded:            pr?.linesAdded    ?? null,
    linesDeleted:          pr?.linesDeleted  ?? null,
    labels,
    discussionCount,
    discussionCharCount,
    discussionCodePercent,
    participantCount,
    issueDurationMs,
    issueTitle:            issueData.title || '',
  });

  return {
    repoName:              parsed.repoFull,
    issueTitle:            issueData.title || '',
    repoCategory:          repoInfo?.primaryLanguage || null,
    prLink:                pr?.prUrl     || null,
    baseSha:               pr?.baseSha   || null,
    filesChanged,
    commitCount:           pr?.commitCount   ?? null,
    linesAdded:            pr?.linesAdded    ?? null,
    linesDeleted:          pr?.linesDeleted  ?? null,
    labels,
    discussionCount,
    discussionCharCount,
    discussionCodePercent,
    issueOpenedAt,
    issueClosedAt,
    issueDurationMs,
    participantCount,
    repoInfo,
    repoScore:           repoAssessment.score,
    repoScoreReport:     repoAssessment.report,
    repoScoreBreakdown:  repoAssessment.breakdown,
    issueScore:          issueAssessment.score,
    issueScoreReport:    issueAssessment.report,
    issueScoreBreakdown: issueAssessment.breakdown,
  };
}

module.exports = { fetchIssueDataFromGitHub, ghHeaders };
