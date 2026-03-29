const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User        = require('../models/User');
const GithubIssue = require('../models/GithubIssue');
const Prompt      = require('../models/Prompt');

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

// POST /v1/issue
// Finds the oldest available issue for the user (own or shared with takenStatus=open),
// fetches the user's main prompt, marks issue as in_progress, and returns both.
router.post('/issue', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  try {
    // Find oldest available issue: user's own open OR shared open from others.
    // Note: match null as well so legacy docs created before the
    // taken→takenStatus migration (which have no takenStatus field) are
    // still considered open.
    const issue = await GithubIssue.findOne({
      takenStatus: { $in: ['open', null] },
      $or: [
        { posterId: me._id },
        { posterId: { $ne: me._id }, shared: true },
      ],
    })
      .populate('posterId', 'username displayName')
      .sort({ createdAt: 1 }); // oldest first

    if (!issue) {
      return res.status(404).json({ success: false, message: 'No available issues found' });
    }

    // Mark as in_progress
    await GithubIssue.findByIdAndUpdate(issue._id, { takenStatus: 'in_progress' });
    issue.takenStatus = 'in_progress';

    // Fetch the user's main prompt; fall back to their most recent prompt
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

    // Allow the user who owns it or who grabbed it (in_progress)
    const isOwner = issue.posterId.toString() === me._id.toString();
    if (!isOwner && issue.takenStatus !== 'in_progress') {
      return res.status(403).json({ success: false, message: 'Cannot mark this issue as done' });
    }

    await GithubIssue.findByIdAndUpdate(issueId, { takenStatus: 'done' });
    res.json({ success: true, message: 'Issue marked as done' });
  } catch (err) {
    console.error('[v1/issue/done]', err);
    res.status(500).json({ success: false, message: 'Failed to mark issue as done' });
  }
});

module.exports = router;
