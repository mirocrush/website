const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User         = require('../models/User');
const Channel      = require('../models/Channel');
const ServerMember = require('../models/ServerMember');
const Conversation = require('../models/Conversation');

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

// POST /api/channels/list
router.post('/list', async (req, res) => {
  const { serverId } = req.body;
  if (!serverId) return res.status(400).json({ success: false, message: 'serverId is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const membership = await ServerMember.findOne({ serverId, userId: me._id });
    if (!membership) return res.status(403).json({ success: false, message: 'Not a member of this server' });
    const channels = await Channel.find({ serverId }).sort({ createdAt: 1 });
    res.json({ success: true, data: channels.map((c) => ({
      id: c._id, name: c.name, type: c.type,
    })) });
  } catch (err) {
    console.error('[channels/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list channels' });
  }
});

// POST /api/channels/create
router.post('/create', async (req, res) => {
  const { serverId, name } = req.body;
  if (!serverId || !name?.trim())
    return res.status(400).json({ success: false, message: 'serverId and name are required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const membership = await ServerMember.findOne({ serverId, userId: me._id });
    if (!membership) return res.status(403).json({ success: false, message: 'Not a member of this server' });

    const channel = await Channel.create({ serverId, name: name.trim() });
    await Conversation.create({ type: 'channel', serverId, channelId: channel._id });

    res.status(201).json({ success: true, data: { id: channel._id, name: channel.name } });
  } catch (err) {
    console.error('[channels/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create channel' });
  }
});

module.exports = router;
