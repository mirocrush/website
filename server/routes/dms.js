const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User               = require('../models/User');
const Conversation       = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');

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

// POST /api/dms/upsert  { otherUserId }
router.post('/upsert', async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ success: false, message: 'otherUserId is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    if (me._id.equals(otherUserId))
      return res.status(400).json({ success: false, message: 'Cannot DM yourself' });

    const other = await User.findById(otherUserId);
    if (!other) return res.status(404).json({ success: false, message: 'User not found' });

    // Deterministic key: sorted IDs joined with _
    const dmKey = [me._id.toString(), otherUserId.toString()].sort().join('_');

    let conv = await Conversation.findOne({ dmKey });
    if (!conv) {
      conv = await Conversation.create({ type: 'dm', dmKey });
      await ConversationMember.insertMany([
        { conversationId: conv._id, userId: me._id },
        { conversationId: conv._id, userId: other._id },
      ]);
    }

    res.json({ success: true, data: { conversationId: conv._id, dmKey } });
  } catch (err) {
    console.error('[dms/upsert]', err);
    res.status(500).json({ success: false, message: 'Failed to upsert DM' });
  }
});

module.exports = router;
