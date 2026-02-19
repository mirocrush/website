const express = require('express');
const jwt     = require('jsonwebtoken');
const Pusher  = require('pusher');
const connectDB = require('../db');
const User               = require('../models/User');
const Conversation       = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const ServerMember       = require('../models/ServerMember');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

const pusher = new Pusher({
  appId:   process.env.PUSHER_APP_ID   || '',
  key:     process.env.PUSHER_KEY      || '',
  secret:  process.env.PUSHER_SECRET   || '',
  cluster: process.env.PUSHER_CLUSTER  || 'us2',
  useTLS:  true,
});

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

// POST /api/pusher/auth  (Pusher private channel auth)
router.post('/auth', async (req, res) => {
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const { socket_id, channel_name } = req.body;
    if (!socket_id || !channel_name)
      return res.status(400).json({ error: 'socket_id and channel_name are required' });

    // channel_name = "private-conv-{conversationId}"
    const conversationId = channel_name.replace('private-conv-', '');

    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(403).json({ error: 'Conversation not found' });

    // Check access
    let hasAccess = false;
    if (conv.type === 'dm') {
      const mem = await ConversationMember.findOne({ conversationId: conv._id, userId: me._id });
      hasAccess = !!mem;
    } else if (conv.type === 'channel') {
      const sm = await ServerMember.findOne({ serverId: conv.serverId, userId: me._id });
      hasAccess = !!sm;
    }

    if (!hasAccess) return res.status(403).json({ error: 'Forbidden' });

    const auth = pusher.authorizeChannel(socket_id, channel_name);
    res.json(auth);
  } catch (err) {
    console.error('[pusher/auth]', err);
    res.status(500).json({ error: 'Auth failed' });
  }
});

module.exports = router;
