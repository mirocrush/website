const express = require('express');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../db');
const User               = require('../models/User');
const Channel            = require('../models/Channel');
const ServerMember       = require('../models/ServerMember');
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
      id: c._id, name: c.name, type: c.type, channelKey: c.channelKey,
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

    const channelKey = uuidv4();
    const channel = await Channel.create({ serverId, name: name.trim(), channelKey });
    await Conversation.create({ type: 'channel', serverId, channelId: channel._id });

    res.status(201).json({ success: true, data: { id: channel._id, name: channel.name, channelKey } });
  } catch (err) {
    console.error('[channels/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create channel' });
  }
});

// POST /api/channels/by-key  { channelKey }
// Resolves channelKey → { channelId, serverId, conversationId, channelKey, channelName }
// Lazily creates ConversationMember for the authed user
router.post('/by-key', async (req, res) => {
  const { channelKey } = req.body;
  if (!channelKey) return res.status(400).json({ success: false, message: 'channelKey is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const channel = await Channel.findOne({ channelKey });
    if (!channel) return res.status(404).json({ success: false, message: 'Channel not found' });

    const membership = await ServerMember.findOne({ serverId: channel.serverId, userId: me._id });
    if (!membership) return res.status(403).json({ success: false, message: 'Not a member of this server' });

    const conv = await Conversation.findOne({ channelId: channel._id });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    await ConversationMember.findOneAndUpdate(
      { conversationId: conv._id, userId: me._id },
      { conversationId: conv._id, userId: me._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: {
      channelId:      channel._id,
      serverId:       channel.serverId,
      conversationId: conv._id,
      channelKey:     channel.channelKey,
      channelName:    channel.name,
    }});
  } catch (err) {
    console.error('[channels/by-key]', err);
    res.status(500).json({ success: false, message: 'Failed to resolve channel' });
  }
});

module.exports = router;
