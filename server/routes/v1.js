const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User        = require('../models/User');
const GithubIssue = require('../models/GithubIssue');
const Prompt      = require('../models/Prompt');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

// ── Watchdog: reset stale 'progress' issues back to 'open' ───────────────
// Runs on every request to this router (serverless-friendly — no setInterval).
let _lastWatchdog = 0;
async function runWatchdog() {
  const now = Date.now();
  if (now - _lastWatchdog < 60_000) return; // at most once per minute
  _lastWatchdog = now;
  const fiveMinAgo = new Date(now - 5 * 60 * 1000);
  try {
    const result = await GithubIssue.updateMany(
      {
        takenStatus: { $in: ['progress', 'progress_interaction'] },
        $or: [
          { lastHeartbeat: { $lt: fiveMinAgo } },
          { lastHeartbeat: null },
        ],
      },
      [{ $set: {
        takenStatus: {
          $cond: [{ $eq: ['$takenStatus', 'progress_interaction'] }, 'initialized', 'open']
        },
        lastHeartbeat: null,
      }}]
    );
    if (result.modifiedCount > 0) {
      console.log(`[watchdog] Reset ${result.modifiedCount} stale progress issue(s) to open`);
    }
  } catch (err) {
    console.error('[watchdog]', err);
  }
}
router.use((_req, _res, next) => { runWatchdog().catch(() => {}); next(); });

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

// POST /v1/issue
// Finds the oldest available issue for the user (own or shared with takenStatus='open' only),
// fetches the user's main prompt, marks issue as progress, and returns both.
router.post('/issue', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  try {
    const issue = await GithubIssue.findOne({
      takenStatus: { $in: ['open', null] },
      $or: [
        { posterId: me._id },
        { posterId: { $ne: me._id }, shared: true },
      ],
    })
      .populate('posterId', 'username displayName')
      .sort({ createdAt: 1 });

    if (!issue) {
      return res.status(404).json({ success: false, message: 'No available issues found' });
    }

    await GithubIssue.findByIdAndUpdate(issue._id, {
      takenStatus: 'progress',
      lastHeartbeat: new Date(),
    });
    issue.takenStatus = 'progress';

    // Resolve prompt: check mainPromptRef first (can be own or another user's shared prompt)
    let prompt = null;
    if (me.mainPromptRef) {
      prompt = await Prompt.findById(me.mainPromptRef);
      if (prompt) {
        const isOwner = prompt.userId.toString() === me._id.toString();
        if (!isOwner && !prompt.shared) prompt = null; // no longer accessible
      }
    }
    if (!prompt) prompt = await Prompt.findOne({ userId: me._id, isMain: true });
    if (!prompt) prompt = await Prompt.findOne({ userId: me._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        issue:  issue.toJSON(),
        prompt: prompt ? prompt.toJSON() : null,
      },
    });
  } catch (err) {
    console.error('[v1/issue]', err);
    res.status(500).json({ success: false, message: 'Failed to get issue' });
  }
});

// POST /v1/interaction-issue
// PR Interaction app: atomically finds the oldest 'initialized' issue accessible to the
// user (own or shared), marks it as 'progress_interaction' with a heartbeat timestamp,
// and returns full issue detail including initialResultDir and uploadFileName.
router.post('/interaction-issue', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  try {
    const issue = await GithubIssue.findOneAndUpdate(
      {
        takenStatus: 'initialized',
        $or: [
          { posterId: me._id },
          { posterId: { $ne: me._id }, shared: true },
        ],
      },
      { $set: { takenStatus: 'progress_interaction', lastHeartbeat: new Date() } },
      { new: true, sort: { createdAt: 1 } }
    ).populate('posterId', 'username displayName');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'No initialized issues found' });
    }

    res.json({ success: true, data: { issue: issue.toJSON() } });
  } catch (err) {
    console.error('[v1/interaction-issue]', err);
    res.status(500).json({ success: false, message: 'Failed to get interaction issue' });
  }
});

// POST /v1/issue/progress
// Heartbeat for PR Preparation — client calls this every minute.
// Body: { issueId }
router.post('/issue/progress', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ success: false, message: 'issueId is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus: 'progress',
      lastHeartbeat: new Date(),
    });
    res.json({ success: true, message: 'Heartbeat received' });
  } catch (err) {
    console.error('[v1/issue/progress]', err);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
});

// POST /v1/issue/progress-interaction
// Heartbeat for PR Interaction — client calls this every minute.
// Body: { issueId }
router.post('/issue/progress-interaction', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ success: false, message: 'issueId is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus: 'progress_interaction',
      lastHeartbeat: new Date(),
    });
    res.json({ success: true, message: 'Heartbeat received' });
  } catch (err) {
    console.error('[v1/issue/progress-interaction]', err);
    res.status(500).json({ success: false, message: 'Failed to update progress' });
  }
});

// POST /v1/issue/reset-to-initialized
// Error recovery — PR Interaction app resets an issue back to 'initialized'
// so it can be retried by the same or another worker.
// Body: { issueId }
router.post('/issue/reset-to-initialized', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ success: false, message: 'issueId is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus: 'initialized',
      lastHeartbeat: null,
    });
    res.json({ success: true, message: 'Issue reset to initialized' });
  } catch (err) {
    console.error('[v1/issue/reset-to-initialized]', err);
    res.status(500).json({ success: false, message: 'Failed to reset issue' });
  }
});

// POST /v1/issue/initialized
// PR Preparation finished — marks issue as 'initialized', stores the result directory name
// and the uploaded zip filename.
// Body: { issueId, initialResultDir, uploadFileName }
router.post('/issue/initialized', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId, initialResultDir, uploadFileName } = req.body;
  if (!issueId)          return res.status(400).json({ success: false, message: 'issueId is required' });
  if (!initialResultDir) return res.status(400).json({ success: false, message: 'initialResultDir is required' });
  if (!uploadFileName)   return res.status(400).json({ success: false, message: 'uploadFileName is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus:      'initialized',
      lastHeartbeat:    null,
      initialResultDir: initialResultDir.trim(),
      uploadFileName:   uploadFileName.trim(),
    });
    res.json({ success: true, message: 'Issue marked as initialized' });
  } catch (err) {
    console.error('[v1/issue/initialized]', err);
    res.status(500).json({ success: false, message: 'Failed to mark issue as initialized' });
  }
});

// POST /v1/issue/interacted
// PR Interaction finished — marks issue as 'interacted', stores the anthropicUUID as
// taskUuid, and optionally stores dockerfileContent and firstPrompt.
// Body: { issueId, taskUuid, dockerfileContent?, firstPrompt? }
router.post('/issue/interacted', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId, taskUuid, dockerfileContent, firstPrompt } = req.body;
  if (!issueId)  return res.status(400).json({ success: false, message: 'issueId is required' });
  if (!taskUuid) return res.status(400).json({ success: false, message: 'taskUuid is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    const update = {
      takenStatus:   'interacted',
      lastHeartbeat: null,
      taskUuid:      taskUuid.trim(),
    };
    if (dockerfileContent !== undefined) update.dockerfileContent = dockerfileContent || null;
    if (firstPrompt       !== undefined) update.firstPrompt       = firstPrompt       || null;

    await GithubIssue.findByIdAndUpdate(issueId, update);
    res.json({ success: true, message: 'Issue marked as interacted' });
  } catch (err) {
    console.error('[v1/issue/interacted]', err);
    res.status(500).json({ success: false, message: 'Failed to mark issue as interacted' });
  }
});

// POST /v1/issue/submitted
// Interaction has been submitted — marks issue as 'submitted'.
// Body: { issueId }
router.post('/issue/submitted', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ success: false, message: 'issueId is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus:   'submitted',
      lastHeartbeat: null,
    });
    res.json({ success: true, message: 'Issue marked as submitted' });
  } catch (err) {
    console.error('[v1/issue/submitted]', err);
    res.status(500).json({ success: false, message: 'Failed to mark issue as submitted' });
  }
});

// POST /v1/issue/failed
// Marks a specific issue as failed (takenStatus = 'failed').
// Body: { issueId }
router.post('/issue/failed', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ success: false, message: 'issueId is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus: 'failed',
      lastHeartbeat: null,
    });
    res.json({ success: true, message: 'Issue marked as failed' });
  } catch (err) {
    console.error('[v1/issue/failed]', err);
    res.status(500).json({ success: false, message: 'Failed to mark issue as failed' });
  }
});

module.exports = router;
