const express    = require('express');
const jwt        = require('jsonwebtoken');
const connectDB  = require('../db');
const User          = require('../models/User');
const SearchSession = require('../models/SearchSession');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(payload.userId);
    const alive   = user?.activeSessions?.some(s => s.sessionId === payload.sessionId);
    if (!user || !alive) {
      res.status(401).json({ success: false, message: 'Session expired' }); return null;
    }
    return user;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid session' }); return null;
  }
}

// GET / — fetch current user's search session
router.get('/', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  try {
    const session = await SearchSession.findOne({ userId: me._id }).lean();
    res.json({ success: true, session: session || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT / — upsert session fields
const ALLOWED = ['isRunning', 'queueItems', 'imported', 'log', 'keyword', 'autoApprove', 'selectedCategories'];
router.put('/', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  try {
    const update = {};
    for (const key of ALLOWED) {
      if (key in req.body) update[key] = req.body[key];
    }
    const session = await SearchSession.findOneAndUpdate(
      { userId: me._id },
      { $set: update },
      { upsert: true, new: true }
    ).lean();
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE / — clear session entirely
router.delete('/', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  try {
    await SearchSession.deleteOne({ userId: me._id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
