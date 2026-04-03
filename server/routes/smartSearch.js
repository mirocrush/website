const express   = require('express');
const jwt       = require('jsonwebtoken');
const axios     = require('axios');
const connectDB = require('../db');
const User      = require('../models/User');
const GithubIssue = require('../models/GithubIssue');
const SavedRepo   = require('../models/SavedRepo');

const router = express.Router();

const GITHUB_API      = 'https://api.github.com';
const VALID_LANGUAGES = ['Python', 'JavaScript', 'TypeScript'];
const TEST_INDICATORS = ['test', 'tests', 'spec', 'specs', '__tests__', 'pytest.ini', 'jest.config'];
const DOC_EXTENSIONS  = ['.md', '.txt', '.rst', '.css', '.scss', '.less', '.html'];
const TRIVIAL_KW      = ['typo', 'rename', 'spelling', 'grammar', 'bump version', 'update readme', 'update docs'];

router.use(async (_req, _res, next) => { await connectDB(); next(); });

// ── Auth ─────────────────────────────────────────────────────────────────────

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(payload.userId);
    const sessionAlive = user?.activeSessions?.some(s => s.sessionId === payload.sessionId);
    if (!user || !sessionAlive) {
      res.status(401).json({ success: false, message: 'Session expired' }); return null;
    }
    return user;
  } catch { res.status(401).json({ success: false, message: 'Invalid session' }); return null; }
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

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
      return { error: r.data?.message || 'GitHub rate limit exceeded. Add a Personal Access Token for 5000 req/hr.', status: r.status, rateLimited: true };
    }
    if (r.status === 404) return { error: 'Not found', status: 404 };
    if (r.status < 200 || r.status >= 300) return { error: r.data?.message || 'GitHub API error', status: r.status };
    return { data: r.data, status: r.status };
  } catch (e) {
    return { error: e.message || 'Network error', status: 0 };
  }
}

// ── Repo scoring ──────────────────────────────────────────────────────────────

async function scoreRepo(repoData, headers) {
  const lang = repoData.language || '';
  if (!VALID_LANGUAGES.includes(lang)) return null;
  if (repoData.size / 1024 > 200) return null;
  if (repoData.archived || repoData.disabled) return null;

  const branch   = repoData.default_branch || 'main';
  const treeResp = await ghGet(
    `${GITHUB_API}/repos/${repoData.full_name}/git/trees/${branch}`,
    headers
  );
  const paths = (treeResp?.data?.tree || []).map(i => i.path.toLowerCase());

  const hasTests     = paths.some(p => TEST_INDICATORS.some(ind => p.includes(ind)));
  const hasReadme    = paths.some(p => p.startsWith('readme'));
  const hasPkg       = ['package.json','setup.py','requirements.txt','pyproject.toml','pipfile','environment.yml']
                         .some(f => paths.includes(f));
  const hasCi        = paths.some(p =>
    ['.github/workflows', '.travis.yml', '.circleci', 'jenkinsfile', '.gitlab-ci.yml']
      .some(f => p.includes(f))
  );
  const hasLinter    = paths.some(p =>
    ['.eslintrc', '.eslintrc.js', '.eslintrc.json', '.pylintrc', '.flake8', 'tslint.json', '.rubocop.yml']
      .some(f => p.includes(f))
  );
  const hasFormatter = paths.some(p =>
    ['.prettierrc', '.editorconfig', '.prettierrc.js', '.prettierrc.json']
      .some(f => p.includes(f))
  );

  let score = 0;
  if (hasTests)     score += 25;
  if (hasReadme)    score += 15;
  if (hasPkg)       score += 15;
  if (hasCi)        score += 10;
  if (hasLinter)    score += 5;
  if (hasFormatter) score += 5;
  if (!repoData.fork) score += 5;

  const stars = repoData.stargazers_count || 0;
  if (stars >= 1000)     score += 10;
  else if (stars >= 100) score += 7;
  else if (stars >= 10)  score += 4;
  else                   score += 1;

  const monthsOld = (Date.now() - new Date(repoData.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsOld < 3)       score += 10;
  else if (monthsOld < 12) score += 7;
  else if (monthsOld < 24) score += 3;

  return {
    fullName:      repoData.full_name,
    htmlUrl:       repoData.html_url,
    description:   repoData.description || '',
    language:      lang,
    stars:         repoData.stargazers_count,
    forks:         repoData.forks_count,
    sizeMb:        Math.round(repoData.size / 1024 * 10) / 10,
    defaultBranch: branch,
    updatedAt:     repoData.updated_at,
    smartScore:    Math.min(100, score),
    checks:        { hasTests, hasReadme, hasPkg, hasCi, hasLinter, hasFormatter },
  };
}

// ── Issue validation ──────────────────────────────────────────────────────────

async function findLinkedPr(headers, repoFull, issueNumber) {
  const tlHeaders = { ...headers, Accept: 'application/vnd.github.mockingbird-preview+json' };
  const tlResp    = await ghGet(
    `${GITHUB_API}/repos/${repoFull}/issues/${issueNumber}/timeline`,
    tlHeaders
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
    const q  = `repo:${repoFull} is:pr is:closed ${issueNumber}`;
    const sr = await ghGet(`${GITHUB_API}/search/issues`, headers, { q, per_page: 10 });
    if (sr?.status === 200) {
      for (const item of sr.data.items || []) {
        const body = (item.body || '').toLowerCase();
        const refs = [`#${issueNumber}`, `fixes #${issueNumber}`, `closes #${issueNumber}`, `resolves #${issueNumber}`];
        if (refs.some(r => body.includes(r))) prNumbers.push(item.number);
      }
    }
  }
  const seen = new Set();
  for (const num of prNumbers) {
    if (seen.has(num)) continue;
    seen.add(num);
    const prResp = await ghGet(`${GITHUB_API}/repos/${repoFull}/pulls/${num}`, headers);
    if (prResp?.status === 200) {
      const pr  = prResp.data;
      const sha = pr.base?.sha;
      if (sha && pr.merged_at) {
        return { prUrl: pr.html_url, baseSha: sha, prNumber: num, changedFiles: pr.changed_files || 0 };
      }
    }
  }
  return null;
}

async function countMeaningfulLines(headers, repoFull, prNumber) {
  const resp = await ghGet(
    `${GITHUB_API}/repos/${repoFull}/pulls/${prNumber}/files`,
    headers,
    { per_page: 100 }
  );
  if (!resp?.data) return { lines: 0, hasTests: false, hasSource: false, allDocs: false };

  const files = resp.data;
  const allDocs = files.every(f =>
    DOC_EXTENSIONS.some(ext => f.filename.toLowerCase().endsWith(ext))
  );
  if (allDocs) return { lines: 0, hasTests: false, hasSource: false, allDocs: true };

  let meaningfulLines = 0, hasTests = false, hasSource = false;
  for (const file of files) {
    const fname  = file.filename.toLowerCase();
    const isTest = TEST_INDICATORS.some(ind => fname.includes(ind));
    const isDoc  = DOC_EXTENSIONS.some(ext => fname.endsWith(ext));
    if (isTest) hasTests = true;
    if (!isTest && !isDoc) hasSource = true;
    if (isDoc) continue;

    const patch = file.patch || '';
    const added = patch.split('\n').filter(line => {
      if (!line.startsWith('+')) return false;
      const c = line.slice(1).trim();
      if (!c) return false;
      if (c.startsWith('#') || c.startsWith('//') || c.startsWith('*') || c.startsWith('/*') || c.startsWith('*/')) return false;
      return true;
    });
    meaningfulLines += added.length;
  }
  return { lines: meaningfulLines, hasTests, hasSource, allDocs: false };
}

async function validateIssue(headers, repoFull, issueData, language) {
  const title    = issueData.title.toLowerCase();
  const body     = issueData.body || '';
  const comments = issueData.comments || 0;

  if (TRIVIAL_KW.some(kw => title.includes(kw))) return null;
  if (body.length < 50) return null;
  if (comments < 2) return null;

  const prInfo = await findLinkedPr(headers, repoFull, issueData.number);
  if (!prInfo) return null;

  const complexity = await countMeaningfulLines(headers, repoFull, prInfo.prNumber);
  if (complexity.lines < 20) return null;
  if (complexity.allDocs)    return null;
  if (!complexity.hasSource) return null;

  return {
    repoName:       repoFull,
    issueLink:      issueData.html_url,
    issueTitle:     issueData.title,
    issueNumber:    issueData.number,
    prLink:         prInfo.prUrl,
    baseSha:        prInfo.baseSha,
    filesChanged:   prInfo.changedFiles,
    repoCategory:   language,
    meaningfulLines: complexity.lines,
    hasTests:       complexity.hasTests,
  };
}

async function fetchAndValidateIssues(headers, repoFull, language, maxIssues = 20) {
  const issResp = await ghGet(`${GITHUB_API}/repos/${repoFull}/issues`, headers, {
    state: 'closed', per_page: 50, sort: 'updated', direction: 'desc',
  });
  if (!issResp?.data) return [];
  const raw     = issResp.data.filter(i => !i.pull_request).slice(0, maxIssues);
  const results = [];
  for (const issue of raw) {
    const r = await validateIssue(headers, repoFull, issue, language);
    if (r) results.push(r);
  }
  return results;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/smart-search/search-repos
router.post('/search-repos', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { keyword, language, token } = req.body;
  if (!keyword || !language) return res.status(400).json({ success: false, message: 'keyword and language required' });

  const headers = ghHeaders(token || process.env.GITHUB_TOKEN);
  const q       = `${keyword} language:${language} is:public fork:false`;
  const resp    = await ghGet(`${GITHUB_API}/search/repositories`, headers, {
    q, sort: 'stars', order: 'desc', per_page: 20,
  });
  if (!resp?.data) {
    const msg = resp?.rateLimited
      ? resp.error
      : (resp?.error || 'GitHub API error');
    return res.status(502).json({ success: false, message: msg });
  }

  const scored = await Promise.all(
    (resp.data.items || []).map(repo => scoreRepo(repo, headers))
  );
  const results = scored.filter(Boolean).sort((a, b) => b.smartScore - a.smartScore);
  res.json({ success: true, data: results });
});

// POST /api/smart-search/validate-url
router.post('/validate-url', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { url, token } = req.body;
  if (!url) return res.status(400).json({ success: false, message: 'url required' });

  const headers = ghHeaders(token || process.env.GITHUB_TOKEN);

  // Detect issue URL vs repo URL
  const issueMatch = url.match(/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/);
  const repoMatch  = !issueMatch && url.match(/github\.com\/([^/]+\/[^/?#]+)/);

  if (issueMatch) {
    const repoFull    = issueMatch[1];
    const issueNumber = parseInt(issueMatch[2]);

    const [repoResp, issueResp] = await Promise.all([
      ghGet(`${GITHUB_API}/repos/${repoFull}`, headers),
      ghGet(`${GITHUB_API}/repos/${repoFull}/issues/${issueNumber}`, headers),
    ]);
    if (!repoResp?.data) {
      const msg = repoResp?.rateLimited ? repoResp.error
        : repoResp?.status === 404 ? `Repository "${repoFull}" not found on GitHub.`
        : (repoResp?.error || 'Could not fetch repo from GitHub');
      return res.status(400).json({ success: false, message: msg });
    }
    if (!issueResp?.data) {
      const msg = issueResp?.status === 404 ? `Issue #${issueNumber} not found.`
        : (issueResp?.error || 'Could not fetch issue from GitHub');
      return res.status(400).json({ success: false, message: msg });
    }

    const repo = repoResp.data;
    if (!VALID_LANGUAGES.includes(repo.language)) {
      return res.json({ success: false, message: `Language '${repo.language}' is not supported (Python/JS/TS only)` });
    }
    if (issueResp.data.pull_request) {
      return res.json({ success: false, message: 'URL points to a Pull Request, not an Issue' });
    }
    const result = await validateIssue(headers, repoFull, issueResp.data, repo.language);
    if (!result) return res.json({ success: false, message: 'Issue did not pass validation criteria' });
    return res.json({ success: true, data: [result] });
  }

  if (repoMatch) {
    const repoFull = repoMatch[1].replace(/\.git$/, '').replace(/\/$/, '');
    const repoResp = await ghGet(`${GITHUB_API}/repos/${repoFull}`, headers);
    if (!repoResp?.data) {
      const msg = repoResp?.rateLimited ? repoResp.error
        : repoResp?.status === 404 ? `Repository "${repoFull}" not found on GitHub.`
        : (repoResp?.error || 'Could not fetch repo from GitHub');
      return res.status(400).json({ success: false, message: msg });
    }
    const repo = repoResp.data;
    if (!VALID_LANGUAGES.includes(repo.language)) {
      return res.json({ success: false, message: `Language '${repo.language}' is not supported (Python/JS/TS only)` });
    }
    const issues = await fetchAndValidateIssues(headers, repoFull, repo.language);
    return res.json({ success: true, data: issues });
  }

  res.status(400).json({ success: false, message: 'Invalid GitHub URL' });
});

// POST /api/smart-search/search-issues
router.post('/search-issues', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { repos, token } = req.body;
  if (!repos?.length) return res.status(400).json({ success: false, message: 'repos array required' });

  const headers = ghHeaders(token || process.env.GITHUB_TOKEN);
  const capped  = repos.slice(0, 3); // cap at 3 repos to avoid timeout

  const perRepo = await Promise.all(
    capped.map(r => fetchAndValidateIssues(headers, r.fullName, r.language, 15))
  );
  const issues = perRepo.flat();
  res.json({ success: true, data: issues });
});

// POST /api/smart-search/import-repos
router.post('/import-repos', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { repos } = req.body;
  if (!repos?.length) return res.status(400).json({ success: false, message: 'repos required' });

  const saved = [];
  for (const r of repos) {
    try {
      const doc = await SavedRepo.findOneAndUpdate(
        { posterId: user._id, fullName: r.fullName },
        {
          posterId: user._id,
          fullName: r.fullName, description: r.description, htmlUrl: r.htmlUrl,
          language: r.language, stars: r.stars, sizeMb: r.sizeMb,
          defaultBranch: r.defaultBranch, updatedAt: r.updatedAt,
          smartScore: r.smartScore, checks: r.checks,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      saved.push(doc);
    } catch { /* skip duplicate constraint errors */ }
  }
  res.json({ success: true, data: saved, count: saved.length });
});

// POST /api/smart-search/saved-repos
router.post('/saved-repos', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const repos = await SavedRepo.find({ posterId: user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data: repos });
});

// POST /api/smart-search/delete-repo
router.post('/delete-repo', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { id } = req.body;
  await SavedRepo.deleteOne({ _id: id, posterId: user._id });
  res.json({ success: true });
});

// POST /api/smart-search/import-issues
router.post('/import-issues', async (req, res) => {
  const user = await requireAuth(req, res);
  if (!user) return;
  const { issues } = req.body;
  if (!issues?.length) return res.status(400).json({ success: false, message: 'issues required' });

  const created = [];
  const failed  = [];   // { issueLink, issueTitle, reason, claimedBy? }

  for (const iss of issues) {
    const link = (iss.issueLink || '').trim();
    if (!link) {
      failed.push({ issueLink: link, issueTitle: iss.issueTitle, reason: 'issueLink is required' });
      continue;
    }

    // Check if current user already owns this issue
    const ownDuplicate = await GithubIssue.findOne({ issueLink: link, posterId: user._id });
    if (ownDuplicate) {
      failed.push({
        issueLink:  link,
        issueTitle: iss.issueTitle,
        reason:     'You already have this issue in your list.',
        code:       'own_duplicate',
      });
      continue;
    }

    // Check if another user already owns this issue
    const conflict = await GithubIssue.findOne({
      issueLink: link,
      posterId:  { $ne: user._id },
    }).populate('posterId', 'username displayName');

    if (conflict) {
      failed.push({
        issueLink:  link,
        issueTitle: iss.issueTitle,
        reason:     `Already claimed by @${conflict.posterId?.username} (status: ${conflict.takenStatus})`,
        code:       'conflict',
        claimedBy: {
          username:    conflict.posterId?.username,
          displayName: conflict.posterId?.displayName,
          takenStatus: conflict.takenStatus,
        },
      });
      continue;
    }

    try {
      const doc = await GithubIssue.create({
        repoName:     iss.repoName,
        issueLink:    link,
        issueTitle:   iss.issueTitle,
        prLink:       iss.prLink || null,
        baseSha:      iss.baseSha,
        repoCategory: iss.repoCategory,
        posterId:     user._id,
        filesChanged: [],
        shared:       false,
        addedVia:     'smart_search',
      });
      created.push(doc);
    } catch (err) {
      // Handle race-condition duplicate key error from MongoDB unique index
      if (err.code === 11000) {
        const owner = await GithubIssue.findOne({ issueLink: link })
          .populate('posterId', 'username');
        failed.push({
          issueLink:  link,
          issueTitle: iss.issueTitle,
          reason:     owner
            ? `Already claimed by @${owner.posterId?.username} (added just now)`
            : 'This issue was just claimed by another user.',
          code: 'conflict',
        });
      } else {
        failed.push({
          issueLink:  link,
          issueTitle: iss.issueTitle,
          reason:     err.message || 'Validation error',
          code:       'validation_error',
        });
      }
    }
  }

  res.json({
    success: true,
    data:    created,
    count:   created.length,
    failed,
    failedCount: failed.length,
  });
});

module.exports = router;
