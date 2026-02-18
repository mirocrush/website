const express   = require('express');
const jwt       = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const connectDB = require('../db');
const User      = require('../models/User');
const Portfolio = require('../models/Portfolio');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user    = await User.findById(payload.userId);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ success: false, message: 'Session expired' });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid session' });
    return null;
  }
}

async function generateUniqueSlug() {
  for (let i = 0; i < 5; i++) {
    const slug = randomBytes(16).toString('hex'); // 32 lowercase hex chars
    const exists = await Portfolio.findOne({ slug });
    if (!exists) return slug;
  }
  throw new Error('Failed to generate unique slug');
}

// ── POST /api/portfolios/list ─────────────────────────────────────────────────

router.post('/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const portfolios = await Portfolio.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: portfolios });
  } catch (err) {
    console.error('[portfolios/list]', err);
    res.status(500).json({ success: false, message: 'Failed to load portfolios' });
  }
});

// ── POST /api/portfolios/create ───────────────────────────────────────────────

router.post('/create', async (req, res) => {
  const { name, title, summary } = req.body;
  if (!name || !title || !summary) {
    return res.status(400).json({ success: false, message: 'name, title, and summary are required' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const slug      = await generateUniqueSlug();
    const portfolio = await Portfolio.create({
      userId:  user._id,
      slug,
      name:    name.trim(),
      title:   title.trim(),
      summary: summary.trim(),
    });

    res.status(201).json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create portfolio' });
  }
});

// ── POST /api/portfolios/update ───────────────────────────────────────────────

router.post('/update', async (req, res) => {
  const { id, name, title, summary } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const portfolio = await Portfolio.findById(id);
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    if (portfolio.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (name    !== undefined) portfolio.name    = name.trim();
    if (title   !== undefined) portfolio.title   = title.trim();
    if (summary !== undefined) portfolio.summary = summary.trim();
    await portfolio.save();

    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update portfolio' });
  }
});

// ── POST /api/portfolios/delete ───────────────────────────────────────────────

router.post('/delete', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const portfolio = await Portfolio.findById(id);
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    if (portfolio.userId.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Portfolio.findByIdAndDelete(id);
    res.json({ success: true, message: 'Portfolio deleted' });
  } catch (err) {
    console.error('[portfolios/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete portfolio' });
  }
});

// ── POST /api/portfolios/get-by-slug ─────────────────────────────────────────

router.post('/get-by-slug', async (req, res) => {
  const { slug } = req.body;
  if (!slug) return res.status(400).json({ success: false, message: 'slug is required' });

  try {
    const portfolio = await Portfolio.findOne({ slug: slug.toLowerCase() })
      .populate('userId', 'displayName');

    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/get-by-slug]', err);
    res.status(500).json({ success: false, message: 'Failed to load portfolio' });
  }
});

module.exports = router;
