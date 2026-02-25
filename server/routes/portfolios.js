const express         = require('express');
const jwt             = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const connectDB       = require('../db');
const User            = require('../models/User');
const Portfolio       = require('../models/Portfolio');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user    = await User.findById(payload.userId);
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      res.status(401).json({ success: false, message: 'Session expired' }); return null;
    }
    return user;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid session' }); return null;
  }
}

async function generateUniqueSlug() {
  for (let i = 0; i < 10; i++) {
    const slug = randomBytes(4).toString('hex');
    if (!await Portfolio.findOne({ slug })) return slug;
  }
  throw new Error('Failed to generate unique slug');
}

const SECTIONS = new Set(['socials','skills','experience','education','projects','certifications']);

// ── POST /api/portfolios/list ─────────────────────────────────────────────────
router.post('/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const portfolios = await Portfolio.find({ userId: user._id })
      .select('slug themeId name title tagline bio avatarUrl location availableForWork settings createdAt updatedAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: portfolios });
  } catch (err) {
    console.error('[portfolios/list]', err);
    res.status(500).json({ success: false, message: 'Failed to load portfolios' });
  }
});

// ── POST /api/portfolios/create ───────────────────────────────────────────────
router.post('/create', async (req, res) => {
  const { name, title, bio } = req.body;
  if (!name || !title) return res.status(400).json({ success: false, message: 'name and title are required' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const slug = await generateUniqueSlug();
    const portfolio = await Portfolio.create({
      userId: user._id, slug,
      name: name.trim(), title: title.trim(), bio: (bio || '').trim(),
    });
    res.status(201).json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create portfolio' });
  }
});

// ── POST /api/portfolios/get ──────────────────────────────────────────────────
router.post('/get', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const portfolio = await Portfolio.findOne({ _id: id, userId: user._id });
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/get]', err);
    res.status(500).json({ success: false, message: 'Failed to get portfolio' });
  }
});

// ── POST /api/portfolios/update-hero ─────────────────────────────────────────
router.post('/update-hero', async (req, res) => {
  const { id, ...fields } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const allowed = ['name','title','tagline','bio','avatarUrl','location','availableForWork','contact','themeId'];
    const update = {};
    for (const key of allowed) {
      if (fields[key] !== undefined) update[key] = fields[key];
    }
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: update },
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/update-hero]', err);
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
    if (portfolio.userId.toString() !== user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    await Portfolio.findByIdAndDelete(id);
    res.json({ success: true });
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
    const portfolio = await Portfolio.findOne({ slug: slug.toLowerCase() }).populate('userId', 'displayName');
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/get-by-slug]', err);
    res.status(500).json({ success: false, message: 'Failed to load portfolio' });
  }
});

// ── POST /api/portfolios/section/add ─────────────────────────────────────────
router.post('/section/add', async (req, res) => {
  const { id, section, item } = req.body;
  if (!id || !section || !item) return res.status(400).json({ success: false, message: 'id, section, and item required' });
  if (!SECTIONS.has(section)) return res.status(400).json({ success: false, message: 'Invalid section' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $push: { [section]: item } },
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/section/add]', err);
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
});

// ── POST /api/portfolios/section/update ──────────────────────────────────────
router.post('/section/update', async (req, res) => {
  const { id, section, itemId, item } = req.body;
  if (!id || !section || !itemId || !item) return res.status(400).json({ success: false, message: 'id, section, itemId, and item required' });
  if (!SECTIONS.has(section)) return res.status(400).json({ success: false, message: 'Invalid section' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const setFields = {};
    for (const [k, v] of Object.entries(item)) {
      setFields[`${section}.$[elem].${k}`] = v;
    }
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: setFields },
      { arrayFilters: [{ 'elem._id': itemId }], new: true }
    );
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/section/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
});

// ── POST /api/portfolios/section/delete ──────────────────────────────────────
router.post('/section/delete', async (req, res) => {
  const { id, section, itemId } = req.body;
  if (!id || !section || !itemId) return res.status(400).json({ success: false, message: 'id, section, and itemId required' });
  if (!SECTIONS.has(section)) return res.status(400).json({ success: false, message: 'Invalid section' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $pull: { [section]: { _id: itemId } } },
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/section/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete item' });
  }
});

// ── POST /api/portfolios/settings/update ─────────────────────────────────────
router.post('/settings/update', async (req, res) => {
  const { id, sectionsOrder, sectionsVisible, seoTitle, seoDescription } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const update = {};
    if (sectionsOrder)              update['settings.sectionsOrder']   = sectionsOrder;
    if (sectionsVisible)            update['settings.sectionsVisible'] = sectionsVisible;
    if (seoTitle !== undefined)     update['settings.seoTitle']        = seoTitle;
    if (seoDescription !== undefined) update['settings.seoDescription'] = seoDescription;
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: id, userId: user._id },
      { $set: update },
      { new: true }
    );
    if (!portfolio) return res.status(404).json({ success: false, message: 'Portfolio not found' });
    res.json({ success: true, data: portfolio });
  } catch (err) {
    console.error('[portfolios/settings/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

module.exports = router;
