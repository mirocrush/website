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
        takenStatus: 'progress',
        $or: [
          { lastHeartbeat: { $lt: fiveMinAgo } },
          { lastHeartbeat: null },
        ],
      },
      { $set: { takenStatus: 'open', lastHeartbeat: null } }
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
// Finds the oldest available issue for the user (own or shared with takenStatus=open),
// fetches the user's main prompt, marks issue as in_progress, and returns both.
router.post('/issue', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  try {
    const issue = await GithubIssue.findOne({
      takenStatus: { $in: ['open', 'failed', null] },
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
      takenStatus: 'in_progress',
      lastHeartbeat: new Date(),
    });
    issue.takenStatus = 'in_progress';

    let prompt = await Prompt.findOne({ userId: me._id, isMain: true });
    if (!prompt) {
      prompt = await Prompt.findOne({ userId: me._id }).sort({ createdAt: -1 });
    }

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

// POST /v1/issue/progress
// Heartbeat — client calls this every minute while actively working on an issue.
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

// POST /v1/issue/done
// Marks a specific issue as done (takenStatus = 'done').
// Body: { issueId }
router.post('/issue/done', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { issueId } = req.body;
  if (!issueId) return res.status(400).json({ success: false, message: 'issueId is required' });

  try {
    const issue = await GithubIssue.findById(issueId);
    if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });

    await GithubIssue.findByIdAndUpdate(issueId, {
      takenStatus: 'done',
      lastHeartbeat: null,
    });
    res.json({ success: true, message: 'Issue marked as done' });
  } catch (err) {
    console.error('[v1/issue/done]', err);
    res.status(500).json({ success: false, message: 'Failed to mark issue as done' });
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
