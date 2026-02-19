const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User           = require('../models/User');
const Server         = require('../models/Server');
const ServerMember   = require('../models/ServerMember');
const Channel        = require('../models/Channel');
const Conversation   = require('../models/Conversation');
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

// POST /api/servers/create
router.post('/create', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'name is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const server = await Server.create({ name: name.trim(), ownerUserId: me._id });
    await ServerMember.create({ serverId: server._id, userId: me._id, roles: ['owner'] });

    // Create default channels + conversations
    const defaultChannels = ['general', 'random'];
    for (const chName of defaultChannels) {
      const channel = await Channel.create({ serverId: server._id, name: chName });
      await Conversation.create({ type: 'channel', serverId: server._id, channelId: channel._id });
    }

    res.status(201).json({ success: true, data: { serverId: server._id, name: server.name } });
  } catch (err) {
    console.error('[servers/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create server' });
  }
});

// POST /api/servers/list
router.post('/list', async (req, res) => {
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const memberships = await ServerMember.find({ userId: me._id });
    const serverIds   = memberships.map((m) => m.serverId);
    const servers     = await Server.find({ _id: { $in: serverIds } }).sort({ createdAt: 1 });

    res.json({ success: true, data: servers.map((s) => ({
      id:      s._id,
      name:    s.name,
      iconUrl: s.iconUrl || null,
      isOwner: s.ownerUserId.equals(me._id),
    })) });
  } catch (err) {
    console.error('[servers/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list servers' });
  }
});

// POST /api/servers/leave
router.post('/leave', async (req, res) => {
  const { serverId } = req.body;
  if (!serverId) return res.status(400).json({ success: false, message: 'serverId is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
    if (server.ownerUserId.equals(me._id))
      return res.status(400).json({ success: false, message: 'Owner cannot leave; delete the server instead' });
    await ServerMember.deleteOne({ serverId, userId: me._id });
    res.json({ success: true, message: 'Left server' });
  } catch (err) {
    console.error('[servers/leave]', err);
    res.status(500).json({ success: false, message: 'Failed to leave server' });
  }
});

module.exports = router;
