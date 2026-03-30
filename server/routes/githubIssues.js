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
    takenStatus,
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

    const validTakenStatuses = ['open', 'progress', 'initialized', 'interacted', 'submitted', 'failed'];
    if (takenStatus && validTakenStatuses.includes(takenStatus)) {
      baseFilter.takenStatus = takenStatus;
    }

    const allowedSortFields = ['repoName', 'issueTitle', 'repoCategory', 'shared', 'takenStatus', 'createdAt'];
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

  const { repoName, issueLink, issueTitle, prLink, filesChanged, baseSha, shared, takenStatus, repoCategory } = req.body;

  if (!repoName || !issueLink || !issueTitle || !baseSha || !repoCategory) {
    return res.status(400).json({ success: false, message: 'repoName, issueLink, issueTitle, baseSha, and repoCategory are required' });
  }

  const validCategories = ['Python', 'JavaScript', 'TypeScript'];
  if (!validCategories.includes(repoCategory)) {
    return res.status(400).json({ success: false, message: 'repoCategory must be Python, JavaScript, or TypeScript' });
  }

  try {
    // Conflict check: does another user already have this exact issue link?
    const conflictingIssues = await GithubIssue.find({
      issueLink: issueLink.trim(),
      posterId:  { $ne: me._id },
    }).populate('posterId', 'username displayName avatarUrl');

    const conflictWarning = conflictingIssues.length > 0
      ? conflictingIssues.map(c => ({
          issueId:     c.id,
          username:    c.posterId?.username,
          displayName: c.posterId?.displayName,
          avatarUrl:   c.posterId?.avatarUrl,
          takenStatus: c.takenStatus,
        }))
      : null;

    const issue = await GithubIssue.create({
      repoName:     repoName.trim(),
      issueLink:    issueLink.trim(),
      issueTitle:   issueTitle.trim(),
      prLink:       prLink ? prLink.trim() : null,
      filesChanged: Array.isArray(filesChanged) ? filesChanged.map(f => f.trim()).filter(Boolean) : [],
      baseSha:      baseSha.trim(),
      posterId:     me._id,
      shared:       Boolean(shared),
      takenStatus:  ['open', 'progress', 'initialized', 'interacted', 'submitted', 'failed'].includes(takenStatus) ? takenStatus : 'open',
      repoCategory,
    });

    await issue.populate('posterId', 'username displayName avatarUrl');
    res.status(201).json({ success: true, data: issue, conflictWarning });
  } catch (err) {
    console.error('[github-issues/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create issue' });
  }
});

// POST /api/github-issues/update
router.post('/update', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id, repoName, issueLink, issueTitle, prLink, filesChanged, baseSha, shared, takenStatus, repoCategory, initialResultDir, uploadFileName, taskUuid } = req.body;
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
    if (shared !== undefined) update.shared = Boolean(shared);
    if (takenStatus !== undefined) {
      if (!['open', 'progress', 'initialized', 'interacted', 'submitted', 'failed'].includes(takenStatus)) {
        return res.status(400).json({ success: false, message: 'takenStatus must be open, progress, initialized, interacted, submitted, or failed' });
      }
      update.takenStatus = takenStatus;
    }
    if (repoCategory !== undefined) {
      const validCategories = ['Python', 'JavaScript', 'TypeScript'];
      if (!validCategories.includes(repoCategory)) {
        return res.status(400).json({ success: false, message: 'repoCategory must be Python, JavaScript, or TypeScript' });
      }
      update.repoCategory = repoCategory;
    }
    if (Array.isArray(filesChanged)) update.filesChanged = filesChanged.map(f => f.trim()).filter(Boolean);
    if (initialResultDir !== undefined) update.initialResultDir = initialResultDir ? initialResultDir.trim() : null;
    if (uploadFileName   !== undefined) update.uploadFileName   = uploadFileName   ? uploadFileName.trim()   : null;
    if (taskUuid         !== undefined) update.taskUuid         = taskUuid         ? taskUuid.trim()         : null;

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

// POST /api/github-issues/check-conflict
// Body: { id } OR { issueLink }
// Returns: { conflicts: [...] } — other users who have the same issue link
router.post('/check-conflict', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id, issueLink } = req.body;

  let link = issueLink;
  if (id) {
    try {
      const issue = await GithubIssue.findById(id);
      if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
      const isOwner = issue.posterId.toString() === me._id.toString();
      if (!isOwner && !issue.shared) return res.status(403).json({ success: false, message: 'Access denied' });
      link = issue.issueLink;
    } catch (err) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
  }

  if (!link) return res.status(400).json({ success: false, message: 'id or issueLink is required' });

  try {
    const conflicts = await GithubIssue.find({
      issueLink: link.trim(),
      posterId:  { $ne: me._id },
    }).populate('posterId', 'username displayName avatarUrl');

    res.json({
      success: true,
      issueLink: link.trim(),
      conflicts: conflicts.map(c => ({
        issueId:     c.id,
        username:    c.posterId?.username,
        displayName: c.posterId?.displayName,
        avatarUrl:   c.posterId?.avatarUrl,
        takenStatus: c.takenStatus,
        repoName:    c.repoName,
      })),
    });
  } catch (err) {
    console.error('[github-issues/check-conflict]', err);
    res.status(500).json({ success: false, message: 'Failed to check conflicts' });
  }
});

module.exports = router;
