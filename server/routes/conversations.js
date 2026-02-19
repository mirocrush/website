const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User               = require('../models/User');
const Server             = require('../models/Server');
const Channel            = require('../models/Channel');
const Conversation       = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const ServerMember       = require('../models/ServerMember');

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

// POST /api/conversations/list
router.post('/list', async (req, res) => {
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const memberships = await ConversationMember.find({ userId: me._id })
      .sort({ updatedAt: -1 })
      .limit(100);

    const convIds = memberships.map((m) => m.conversationId);
    const convs   = await Conversation.find({ _id: { $in: convIds } });
    const convMap = Object.fromEntries(convs.map((c) => [c._id.toString(), c]));

    const results = [];
    for (const mem of memberships) {
      const conv = convMap[mem.conversationId.toString()];
      if (!conv) continue;

      let title = '', avatarUrl = null, otherUserId = null;

      if (conv.type === 'dm') {
        // Find the other member
        const otherMem = await ConversationMember.findOne({
          conversationId: conv._id,
          userId: { $ne: me._id },
        });
        if (otherMem) {
          const other = await User.findById(otherMem.userId).select('displayName avatarUrl');
          if (other) { title = other.displayName; avatarUrl = other.avatarUrl; otherUserId = other._id; }
        }
      } else {
        const channel = await Channel.findById(conv.channelId).select('name');
        const server  = await Server.findById(conv.serverId).select('name iconUrl');
        if (channel && server) {
          title = `#${channel.name}`;
          avatarUrl = server.iconUrl;
        }
      }

      const unread = conv.lastMessageAt && mem.lastReadAt
        ? conv.lastMessageAt > mem.lastReadAt
        : !!conv.lastMessageAt;

      results.push({
        conversationId: conv._id,
        type:           conv.type,
        title,
        avatarUrl,
        otherUserId,
        serverId:    conv.serverId  || null,
        channelId:   conv.channelId || null,
        lastMessageAt: conv.lastMessageAt || null,
        unread,
      });
    }

    // Sort by lastMessageAt desc (nulls last)
    results.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
    });

    res.json({ success: true, data: results });
  } catch (err) {
    console.error('[conversations/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list conversations' });
  }
});

// POST /api/conversations/from-channel  { serverId, channelId }
router.post('/from-channel', async (req, res) => {
  const { serverId, channelId } = req.body;
  if (!serverId || !channelId)
    return res.status(400).json({ success: false, message: 'serverId and channelId are required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const membership = await ServerMember.findOne({ serverId, userId: me._id });
    if (!membership)
      return res.status(403).json({ success: false, message: 'Not a member of this server' });

    const conv = await Conversation.findOne({ channelId });
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });

    // Lazily create ConversationMember if missing
    await ConversationMember.findOneAndUpdate(
      { conversationId: conv._id, userId: me._id },
      { conversationId: conv._id, userId: me._id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: { conversationId: conv._id } });
  } catch (err) {
    console.error('[conversations/from-channel]', err);
    res.status(500).json({ success: false, message: 'Failed to get conversation' });
  }
});

// POST /api/conversations/read  { conversationId, lastReadMessageId }
router.post('/read', async (req, res) => {
  const { conversationId, lastReadMessageId } = req.body;
  if (!conversationId || !lastReadMessageId)
    return res.status(400).json({ success: false, message: 'conversationId and lastReadMessageId are required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    await ConversationMember.findOneAndUpdate(
      { conversationId, userId: me._id },
      { lastReadMessageId, lastReadAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[conversations/read]', err);
    res.status(500).json({ success: false, message: 'Failed to mark read' });
  }
});

module.exports = router;
