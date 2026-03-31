const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User   = require('../models/User');
const Prompt = require('../models/Prompt');

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

// Ensure only one main prompt per user.
// If setting isMain=true, unset all others for this user first.
async function setMain(userId, promptId) {
  await Prompt.updateMany({ userId, _id: { $ne: promptId } }, { isMain: false });
  await Prompt.findByIdAndUpdate(promptId, { isMain: true });
}

// POST /api/prompts/list
// Returns: own prompts + shared prompts from other users
router.post('/list', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { search = '', shared, sortField = 'createdAt', sortDir = 'desc', page = 1, limit = 20 } = req.body;

  try {
    const baseFilter = {
      $or: [
        { userId: me._id },
        { userId: { $ne: me._id }, shared: true },
      ],
    };

    if (search) {
      const re = new RegExp(search, 'i');
      baseFilter.$and = [{ $or: [{ title: re }, { content: re }] }];
    }

    if (shared !== undefined && shared !== '') {
      baseFilter.shared = shared === true || shared === 'true';
    }

    const allowedSort = ['title', 'shared', 'isMain', 'createdAt'];
    const sort = {
      [allowedSort.includes(sortField) ? sortField : 'createdAt']: sortDir === 'asc' ? 1 : -1,
    };

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip     = (pageNum - 1) * limitNum;

    const [prompts, total] = await Promise.all([
      Prompt.find(baseFilter)
        .populate('userId', 'username displayName avatarUrl')
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Prompt.countDocuments(baseFilter),
    ]);

    res.json({ success: true, data: prompts, total, page: pageNum, limit: limitNum });
  } catch (err) {
    console.error('[prompts/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list prompts' });
  }
});

// POST /api/prompts/get
router.post('/get', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const prompt = await Prompt.findById(id).populate('userId', 'username displayName avatarUrl');
    if (!prompt) return res.status(404).json({ success: false, message: 'Prompt not found' });

    const isOwner = prompt.userId._id.toString() === me._id.toString();
    if (!isOwner && !prompt.shared) return res.status(403).json({ success: false, message: 'Access denied' });

    res.json({ success: true, data: prompt });
  } catch (err) {
    console.error('[prompts/get]', err);
    res.status(500).json({ success: false, message: 'Failed to get prompt' });
  }
});

// POST /api/prompts/create
router.post('/create', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { title, content, shared } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, message: 'title and content are required' });
  }

  try {
    // Count existing prompts for this user
    const existingCount = await Prompt.countDocuments({ userId: me._id });

    const prompt = await Prompt.create({
      userId:  me._id,
      title:   title.trim(),
      content,
      shared:  Boolean(shared),
      isMain:  existingCount === 0, // first prompt → auto-main
    });

    if (existingCount === 0) {
      // no need to call setMain — already set during create
    }

    await prompt.populate('userId', 'username displayName avatarUrl');
    res.status(201).json({ success: true, data: prompt });
  } catch (err) {
    console.error('[prompts/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create prompt' });
  }
});

// POST /api/prompts/update
router.post('/update', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id, title, content, shared, isMain } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const prompt = await Prompt.findById(id);
    if (!prompt) return res.status(404).json({ success: false, message: 'Prompt not found' });
    if (prompt.userId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can edit this prompt' });
    }

    const update = {};
    if (title   !== undefined) update.title   = title.trim();
    if (content !== undefined) update.content = content;
    if (shared  !== undefined) update.shared  = Boolean(shared);

    await Prompt.findByIdAndUpdate(id, update, { runValidators: true });

    // Handle isMain separately — must unset other mains first
    if (isMain === true) {
      await setMain(me._id, id);
    }

    const updated = await Prompt.findById(id).populate('userId', 'username displayName avatarUrl');
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[prompts/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update prompt' });
  }
});

// POST /api/prompts/set-main
router.post('/set-main', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const prompt = await Prompt.findById(id);
    if (!prompt) return res.status(404).json({ success: false, message: 'Prompt not found' });
    if (prompt.userId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can set main prompt' });
    }

    await setMain(me._id, id);
    res.json({ success: true, message: 'Main prompt updated' });
  } catch (err) {
    console.error('[prompts/set-main]', err);
    res.status(500).json({ success: false, message: 'Failed to set main prompt' });
  }
});


// POST /api/prompts/clone
// Creates a copy of any accessible prompt under the current user.
// Title gets " -cloned" appended. Content is copied as-is. Always private.
router.post('/clone', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const original = await Prompt.findById(id);
    if (!original) return res.status(404).json({ success: false, message: 'Prompt not found' });

    const isOwner = original.userId.toString() === me._id.toString();
    if (!isOwner && !original.shared) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const existingCount = await Prompt.countDocuments({ userId: me._id });
    const cloned = await Prompt.create({
      userId:  me._id,
      title:   `${original.title} -cloned`,
      content: original.content,
      shared:  false,
      isMain:  existingCount === 0,
    });

    await cloned.populate('userId', 'username displayName avatarUrl');
    res.status(201).json({ success: true, data: cloned });
  } catch (err) {
    console.error('[prompts/clone]', err);
    res.status(500).json({ success: false, message: 'Failed to clone prompt' });
  }
});

// POST /api/prompts/delete
router.post('/delete', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const prompt = await Prompt.findById(id);
    if (!prompt) return res.status(404).json({ success: false, message: 'Prompt not found' });
    if (prompt.userId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can delete this prompt' });
    }

    const wasMain = prompt.isMain;
    await Prompt.findByIdAndDelete(id);

    // If deleted prompt was main, make oldest remaining prompt the new main
    if (wasMain) {
      const next = await Prompt.findOne({ userId: me._id }).sort({ createdAt: 1 });
      if (next) await setMain(me._id, next._id);
    }

    res.json({ success: true, message: 'Prompt deleted' });
  } catch (err) {
    console.error('[prompts/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete prompt' });
  }
});

module.exports = router;
