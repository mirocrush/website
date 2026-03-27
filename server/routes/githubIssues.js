const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User        = require('../models/User');
const GithubIssue = require('../models/GithubIssue');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(payload.userId);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ success: false, message: 'Session expired' }); return null;
    }
    return user;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid session' }); return null;
  }
}

// POST /api/github-issues/list
// Returns: own issues + shared issues from other users
// Body: { search, category, shared, taken, sortField, sortDir, page, limit }
router.post('/list', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const {
    search = '',
    category,
    shared,
    taken,
    sortField = 'createdAt',
    sortDir   = 'desc',
    page      = 1,
    limit     = 20,
  } = req.body;

  try {
    // Base filter: own issues OR other users' shared issues
    const baseFilter = {
      $or: [
        { posterId: me._id },
        { posterId: { $ne: me._id }, shared: true },
      ],
    };

    if (search) {
      const re = new RegExp(search, 'i');
      baseFilter.$and = [{ $or: [{ repoName: re }, { issueTitle: re }] }];
    }

    if (category) baseFilter.repoCategory = category;

    if (shared !== undefined && shared !== '') {
      baseFilter.shared = shared === true || shared === 'true';
    }

    if (taken !== undefined && taken !== '') {
      baseFilter.taken = taken === true || taken === 'true';
    }

    const allowedSortFields = ['repoName', 'issueTitle', 'repoCategory', 'shared', 'taken', 'createdAt'];
    const sort = {
      [allowedSortFields.includes(sortField) ? sortField : 'createdAt']:
        sortDir === 'asc' ? 1 : -1,
    };

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    const [issues, total] = await Promise.all([
      GithubIssue.find(baseFilter)
        .populate('posterId', 'username displayName avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      GithubIssue.countDocuments(baseFilter),
    ]);

    res.json({ success: true, data: issues, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('[github-issues/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list issues' });
  }
});

// POST /api/github-issues/get
router.post('/get', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const issue = await GithubIssue.findById(id).populate('posterId', 'username displayName avatarUrl');
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const isOwner   = issue.posterId._id.toString() === me._id.toString();
    const canAccess = isOwner || issue.shared;
    if (!canAccess) return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: issue });
  } catch (err) {
    console.error('[github-issues/get]', err);
    res.status(500).json({ success: false, message: 'Failed to get issue' });
  }
});

// POST /api/github-issues/create
router.post('/create', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { repoName, issueLink, issueTitle, prLink, filesChanged, baseSha, shared, taken, repoCategory } = req.body;

  if (!repoName || !issueLink || !issueTitle || !baseSha || !repoCategory) {
    return res.status(400).json({ success: false, message: 'repoName, issueLink, issueTitle, baseSha, and repoCategory are required' });
  }

  const validCategories = ['Python', 'JavaScript', 'TypeScript'];
  if (!validCategories.includes(repoCategory)) {
    return res.status(400).json({ success: false, message: 'repoCategory must be Python, JavaScript, or TypeScript' });
  }

  try {
    const issue = await GithubIssue.create({
      repoName:     repoName.trim(),
      issueLink:    issueLink.trim(),
      issueTitle:   issueTitle.trim(),
      prLink:       prLink ? prLink.trim() : null,
      filesChanged: Array.isArray(filesChanged) ? filesChanged.map(f => f.trim()).filter(Boolean) : [],
      baseSha:      baseSha.trim(),
      posterId:     me._id,
      shared:       Boolean(shared),
      taken:        Boolean(taken),
      repoCategory,
    });

    await issue.populate('posterId', 'username displayName avatarUrl');
    res.status(201).json({ success: true, data: issue });
  } catch (err) {
    console.error('[github-issues/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create issue' });
  }
});

// POST /api/github-issues/update
router.post('/update', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id, repoName, issueLink, issueTitle, prLink, filesChanged, baseSha, shared, taken, repoCategory } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const issue = await GithubIssue.findById(id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.posterId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the poster can edit this issue' });
    }

    const update = {};
    if (repoName    !== undefined) update.repoName    = repoName.trim();
    if (issueLink   !== undefined) update.issueLink   = issueLink.trim();
    if (issueTitle  !== undefined) update.issueTitle  = issueTitle.trim();
    if (prLink      !== undefined) update.prLink      = prLink ? prLink.trim() : null;
    if (baseSha     !== undefined) update.baseSha     = baseSha.trim();
    if (shared      !== undefined) update.shared      = Boolean(shared);
    if (taken       !== undefined) update.taken       = Boolean(taken);
    if (repoCategory !== undefined) {
      const validCategories = ['Python', 'JavaScript', 'TypeScript'];
      if (!validCategories.includes(repoCategory)) {
        return res.status(400).json({ success: false, message: 'repoCategory must be Python, JavaScript, or TypeScript' });
      }
      update.repoCategory = repoCategory;
    }
    if (Array.isArray(filesChanged)) update.filesChanged = filesChanged.map(f => f.trim()).filter(Boolean);

    const updated = await GithubIssue.findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('posterId', 'username displayName avatarUrl');

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[github-issues/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update issue' });
  }
});

// POST /api/github-issues/delete
router.post('/delete', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const issue = await GithubIssue.findById(id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.posterId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the poster can delete this issue' });
    }

    await GithubIssue.findByIdAndDelete(id);
    res.json({ success: true, message: 'Issue deleted' });
  } catch (err) {
    console.error('[github-issues/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete issue' });
  }
});

module.exports = router;
