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
    const sessionAlive = user?.activeSessions?.some(s => s.sessionId === payload.sessionId);
    if (!user || !sessionAlive) {
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

    const validTakenStatuses = ['open', 'progress', 'initialized', 'progress_interaction', 'interacted', 'submitted', 'failed'];
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

  const normalizedLink = issueLink.trim();

  try {
    // ── Duplicate check: does THIS user already have the same issue? ─────
    const ownDuplicate = await GithubIssue.findOne({
      issueLink: normalizedLink,
      posterId:  me._id,
    });
    if (ownDuplicate) {
      return res.status(409).json({
        success: false,
        message: 'You already have this issue in your list.',
        reason:  'own_duplicate',
      });
    }

    // ── Conflict check: does another user already own this issue link? ───
    const conflict = await GithubIssue.findOne({
      issueLink: normalizedLink,
      posterId:  { $ne: me._id },
    }).populate('posterId', 'username displayName');

    if (conflict) {
      return res.status(409).json({
        success: false,
        message: `This issue is already claimed by @${conflict.posterId?.username} (status: ${conflict.takenStatus}). Each issue can only be added by one user.`,
        reason:  'conflict',
        claimedBy: {
          username:    conflict.posterId?.username,
          displayName: conflict.posterId?.displayName,
          takenStatus: conflict.takenStatus,
        },
      });
    }

    const issue = await GithubIssue.create({
      repoName:     repoName.trim(),
      issueLink:    normalizedLink,
      issueTitle:   issueTitle.trim(),
      prLink:       prLink ? prLink.trim() : null,
      filesChanged: Array.isArray(filesChanged) ? filesChanged.map(f => f.trim()).filter(Boolean) : [],
      baseSha:      baseSha.trim(),
      posterId:     me._id,
      shared:       Boolean(shared),
      takenStatus:  ['open', 'progress', 'initialized', 'progress_interaction', 'interacted', 'submitted', 'failed'].includes(takenStatus) ? takenStatus : 'open',
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
      if (!['open', 'progress', 'initialized', 'progress_interaction', 'interacted', 'submitted', 'failed'].includes(takenStatus)) {
        return res.status(400).json({ success: false, message: 'takenStatus must be open, progress, initialized, progress_interaction, interacted, submitted, or failed' });
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

// POST /api/github-issues/search-users
router.post('/search-users', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { query = '' } = req.body;
  if (!query.trim()) return res.json({ success: true, data: [] });
  try {
    const re = new RegExp(query.trim(), 'i');
    const users = await User.find({
      _id: { $ne: me._id },
      $or: [{ username: re }, { displayName: re }],
    }).select('username displayName avatarUrl').limit(10);
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('[github-issues/search-users]', err);
    res.status(500).json({ success: false, message: 'Failed to search users' });
  }
});

// POST /api/github-issues/transfer — initiate a pending transfer request
router.post('/transfer', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id, toUserId } = req.body;
  if (!id || !toUserId) {
    return res.status(400).json({ success: false, message: 'id and toUserId are required' });
  }
  try {
    const issue = await GithubIssue.findById(id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.posterId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can transfer this issue' });
    }
    const target = await User.findById(toUserId).select('username displayName');
    if (!target) return res.status(404).json({ success: false, message: 'Target user not found' });

    issue.pendingTransfer = { toUserId, toUsername: target.username, requestedAt: new Date() };
    await issue.save();
    const updated = await GithubIssue.findById(id).populate('posterId', 'username displayName avatarUrl');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[github-issues/transfer]', err);
    res.status(500).json({ success: false, message: 'Failed to initiate transfer' });
  }
});

// POST /api/github-issues/transfer-multiple — initiate pending transfers for multiple issues
router.post('/transfer-multiple', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { ids, toUserId } = req.body;
  if (!Array.isArray(ids) || ids.length === 0 || !toUserId) {
    return res.status(400).json({ success: false, message: 'ids (array) and toUserId are required' });
  }
  try {
    const target = await User.findById(toUserId).select('username displayName');
    if (!target) return res.status(404).json({ success: false, message: 'Target user not found' });

    const issues = await GithubIssue.find({ _id: { $in: ids }, posterId: me._id });
    if (issues.length === 0) return res.status(403).json({ success: false, message: 'No matching owned issues found' });

    const pendingTransfer = { toUserId, toUsername: target.username, requestedAt: new Date() };
    await GithubIssue.updateMany({ _id: { $in: issues.map((i) => i._id) } }, { pendingTransfer });

    const updated = await GithubIssue.find({ _id: { $in: ids } })
      .populate('posterId', 'username displayName avatarUrl');
    res.json({ success: true, data: updated, count: updated.length });
  } catch (err) {
    console.error('[github-issues/transfer-multiple]', err);
    res.status(500).json({ success: false, message: 'Failed to initiate transfers' });
  }
});

// POST /api/github-issues/transfer-cancel — sender cancels a pending transfer
router.post('/transfer-cancel', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const issue = await GithubIssue.findById(id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (issue.posterId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can cancel this transfer' });
    }
    issue.pendingTransfer = { toUserId: null, toUsername: null, requestedAt: null };
    await issue.save();
    const updated = await GithubIssue.findById(id).populate('posterId', 'username displayName avatarUrl');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[github-issues/transfer-cancel]', err);
    res.status(500).json({ success: false, message: 'Failed to cancel transfer' });
  }
});

// POST /api/github-issues/transfer-accept — recipient accepts a pending transfer
router.post('/transfer-accept', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const issue = await GithubIssue.findById(id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (!issue.pendingTransfer?.toUserId || issue.pendingTransfer.toUserId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'This transfer is not addressed to you' });
    }
    issue.posterId = me._id;
    issue.pendingTransfer = { toUserId: null, toUsername: null, requestedAt: null };
    await issue.save();
    const updated = await GithubIssue.findById(id).populate('posterId', 'username displayName avatarUrl');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[github-issues/transfer-accept]', err);
    res.status(500).json({ success: false, message: 'Failed to accept transfer' });
  }
});

// POST /api/github-issues/transfer-reject — recipient rejects a pending transfer
router.post('/transfer-reject', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const issue = await GithubIssue.findById(id);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (!issue.pendingTransfer?.toUserId || issue.pendingTransfer.toUserId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'This transfer is not addressed to you' });
    }
    issue.pendingTransfer = { toUserId: null, toUsername: null, requestedAt: null };
    await issue.save();
    const updated = await GithubIssue.findById(id).populate('posterId', 'username displayName avatarUrl');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[github-issues/transfer-reject]', err);
    res.status(500).json({ success: false, message: 'Failed to reject transfer' });
  }
});

// POST /api/github-issues/incoming-transfers — pending transfers addressed to me
router.post('/incoming-transfers', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  try {
    const issues = await GithubIssue.find({ 'pendingTransfer.toUserId': me._id })
      .populate('posterId', 'username displayName avatarUrl')
      .sort({ 'pendingTransfer.requestedAt': -1 });
    res.json({ success: true, data: issues });
  } catch (err) {
    console.error('[github-issues/incoming-transfers]', err);
    res.status(500).json({ success: false, message: 'Failed to load incoming transfers' });
  }
});

module.exports = router;
