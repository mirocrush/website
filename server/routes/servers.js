const express = require('express');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../db');
const User           = require('../models/User');
const Server         = require('../models/Server');
const ServerMember   = require('../models/ServerMember');
const ServerBan      = require('../models/ServerBan');
const Channel        = require('../models/Channel');
const Conversation   = require('../models/Conversation');

const router = express.Router();

router.use(async (_req, _res, next) => { await connectDB(); next(); });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const iconUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed for server icons'));
  },
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

function publicServer(s, memberCount, isOwner) {
  return {
    id:          s._id,
    name:        s.name,
    iconUrl:     s.iconUrl || null,
    isPublic:    s.isPublic,
    inviteKey:   s.inviteKey || null,
    isOwner:     isOwner,
    memberCount: memberCount || 0,
  };
}

// POST /api/servers/create
router.post('/create', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'name is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const inviteKey = uuidv4();
    const server = await Server.create({ name: name.trim(), ownerUserId: me._id, inviteKey });
    await ServerMember.create({ serverId: server._id, userId: me._id, roles: ['owner'] });

    // Create default channels + conversations (each with a channelKey)
    const defaultChannels = ['general', 'random'];
    let firstChannelKey = null;
    for (const chName of defaultChannels) {
      const channelKey = uuidv4();
      const channel = await Channel.create({ serverId: server._id, name: chName, channelKey });
      await Conversation.create({ type: 'channel', serverId: server._id, channelId: channel._id });
      if (!firstChannelKey) firstChannelKey = channelKey;
    }

    res.status(201).json({ success: true, data: {
      serverId:       server._id,
      name:           server.name,
      inviteKey,
      firstChannelKey,
    }});
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

    const counts = await Promise.all(
      servers.map((s) => ServerMember.countDocuments({ serverId: s._id }))
    );

    res.json({ success: true, data: servers.map((s, i) =>
      publicServer(s, counts[i], s.ownerUserId.equals(me._id))
    )});
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

// POST /api/servers/discover  { page=1, limit=20, search='', sort='members' }
// Public — no auth required
router.post('/discover', async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', sort = 'members' } = req.body;
    const cap  = Math.min(Number(limit) || 20, 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * cap;

    const filter = { isPublic: true };
    if (search.trim()) filter.name = { $regex: search.trim(), $options: 'i' };

    const servers = await Server.find(filter)
      .select('name iconUrl inviteKey createdAt ownerUserId')
      .sort(sort === 'newest' ? { createdAt: -1 } : { createdAt: -1 }) // member count sort below
      .skip(skip)
      .limit(cap);

    const total = await Server.countDocuments(filter);

    const results = await Promise.all(servers.map(async (s) => {
      const memberCount = await ServerMember.countDocuments({ serverId: s._id });
      return { id: s._id, name: s.name, iconUrl: s.iconUrl || null, inviteKey: s.inviteKey, memberCount };
    }));

    // Sort by member count if requested (post-query since it's a derived value)
    if (sort === 'members') results.sort((a, b) => b.memberCount - a.memberCount);

    res.json({ success: true, data: results, total, page: Number(page), pages: Math.ceil(total / cap) });
  } catch (err) {
    console.error('[servers/discover]', err);
    res.status(500).json({ success: false, message: 'Failed to discover servers' });
  }
});

// POST /api/servers/invite-info  { inviteKey }
// Public — no auth required
router.post('/invite-info', async (req, res) => {
  const { inviteKey } = req.body;
  if (!inviteKey) return res.status(400).json({ success: false, message: 'inviteKey is required' });
  try {
    const server = await Server.findOne({ inviteKey }).populate('ownerUserId', 'displayName username');
    if (!server) return res.status(404).json({ success: false, message: 'Invite link not found' });
    const memberCount = await ServerMember.countDocuments({ serverId: server._id });
    res.json({ success: true, data: {
      id:          server._id,
      name:        server.name,
      iconUrl:     server.iconUrl || null,
      memberCount,
      ownerName:   server.ownerUserId?.displayName || '',
    }});
  } catch (err) {
    console.error('[servers/invite-info]', err);
    res.status(500).json({ success: false, message: 'Failed to load invite info' });
  }
});

// POST /api/servers/join  { inviteKey }
router.post('/join', async (req, res) => {
  const { inviteKey } = req.body;
  if (!inviteKey) return res.status(400).json({ success: false, message: 'inviteKey is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const server = await Server.findOne({ inviteKey });
    if (!server) return res.status(404).json({ success: false, message: 'Invite link not found' });

    // Check ban
    const ban = await ServerBan.findOne({ serverId: server._id, bannedUserId: me._id });
    if (ban) return res.status(403).json({ success: false, message: 'You are banned from this server' });

    // Already a member?
    const existing = await ServerMember.findOne({ serverId: server._id, userId: me._id });
    if (existing) {
      // Find first channel to redirect
      const firstChannel = await Channel.findOne({ serverId: server._id }).sort({ createdAt: 1 });
      return res.json({ success: true, alreadyMember: true, data: {
        serverId: server._id, firstChannelKey: firstChannel?.channelKey || null,
      }});
    }

    await ServerMember.create({ serverId: server._id, userId: me._id });

    const firstChannel = await Channel.findOne({ serverId: server._id }).sort({ createdAt: 1 });
    res.status(201).json({ success: true, data: {
      serverId: server._id, firstChannelKey: firstChannel?.channelKey || null,
    }});
  } catch (err) {
    console.error('[servers/join]', err);
    res.status(500).json({ success: false, message: 'Failed to join server' });
  }
});

// POST /api/servers/update  multipart { serverId, name? } + optional icon file
router.post('/update', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  iconUpload.single('icon')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    const { serverId, name } = req.body;
    if (!serverId) return res.status(400).json({ success: false, message: 'serverId is required' });

    try {
      const server = await Server.findById(serverId);
      if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
      if (!server.ownerUserId.equals(me._id))
        return res.status(403).json({ success: false, message: 'Only the owner can update this server' });

      if (name?.trim()) server.name = name.trim();

      if (req.file) {
        const ext      = req.file.originalname.split('.').pop().toLowerCase();
        const filePath = `server-icons/${server._id}/${uuidv4()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('attachments')
          .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: true });
        if (uploadErr) return res.status(500).json({ success: false, message: uploadErr.message });
        const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);
        server.iconUrl = data.publicUrl;
      }

      await server.save();
      res.json({ success: true, data: { id: server._id, name: server.name, iconUrl: server.iconUrl } });
    } catch (err2) {
      console.error('[servers/update]', err2);
      res.status(500).json({ success: false, message: 'Failed to update server' });
    }
  });
});

// POST /api/servers/members  { serverId }
router.post('/members', async (req, res) => {
  const { serverId } = req.body;
  if (!serverId) return res.status(400).json({ success: false, message: 'serverId is required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const myMem = await ServerMember.findOne({ serverId, userId: me._id });
    if (!myMem) return res.status(403).json({ success: false, message: 'Not a member of this server' });

    const server  = await Server.findById(serverId);
    const members = await ServerMember.find({ serverId }).sort({ joinedAt: 1 });
    const userIds = members.map((m) => m.userId);
    const users   = await User.find({ _id: { $in: userIds } }).select('displayName username avatarUrl');
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const data = members.map((m) => {
      const u = userMap[m.userId.toString()];
      if (!u) return null;
      return {
        userId:      u._id,
        displayName: u.displayName,
        username:    u.username,
        avatarUrl:   u.avatarUrl || null,
        roles:       m.roles,
        muted:       m.muted,
        joinedAt:    m.joinedAt,
        isOwner:     server && server.ownerUserId.equals(u._id),
      };
    }).filter(Boolean);

    res.json({ success: true, data });
  } catch (err) {
    console.error('[servers/members]', err);
    res.status(500).json({ success: false, message: 'Failed to list members' });
  }
});

// POST /api/servers/kick  { serverId, userId }
router.post('/kick', async (req, res) => {
  const { serverId, userId } = req.body;
  if (!serverId || !userId) return res.status(400).json({ success: false, message: 'serverId and userId are required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
    if (!server.ownerUserId.equals(me._id))
      return res.status(403).json({ success: false, message: 'Only the owner can kick members' });
    if (server.ownerUserId.equals(userId))
      return res.status(400).json({ success: false, message: 'Cannot kick the owner' });
    await ServerMember.deleteOne({ serverId, userId });
    res.json({ success: true, message: 'Member kicked' });
  } catch (err) {
    console.error('[servers/kick]', err);
    res.status(500).json({ success: false, message: 'Failed to kick member' });
  }
});

// POST /api/servers/ban  { serverId, userId, reason? }
router.post('/ban', async (req, res) => {
  const { serverId, userId, reason = '' } = req.body;
  if (!serverId || !userId) return res.status(400).json({ success: false, message: 'serverId and userId are required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
    if (!server.ownerUserId.equals(me._id))
      return res.status(403).json({ success: false, message: 'Only the owner can ban members' });
    if (server.ownerUserId.equals(userId))
      return res.status(400).json({ success: false, message: 'Cannot ban the owner' });
    await ServerMember.deleteOne({ serverId, userId });
    await ServerBan.findOneAndUpdate(
      { serverId, bannedUserId: userId },
      { serverId, bannedUserId: userId, bannedByUserId: me._id, reason },
      { upsert: true, new: true }
    );
    res.json({ success: true, message: 'Member banned' });
  } catch (err) {
    console.error('[servers/ban]', err);
    res.status(500).json({ success: false, message: 'Failed to ban member' });
  }
});

// POST /api/servers/mute  { serverId, userId, muted }
router.post('/mute', async (req, res) => {
  const { serverId, userId, muted } = req.body;
  if (!serverId || !userId || muted === undefined)
    return res.status(400).json({ success: false, message: 'serverId, userId, and muted are required' });
  try {
    const me = await requireAuth(req, res);
    if (!me) return;
    const server = await Server.findById(serverId);
    if (!server) return res.status(404).json({ success: false, message: 'Server not found' });
    if (!server.ownerUserId.equals(me._id))
      return res.status(403).json({ success: false, message: 'Only the owner can mute members' });
    await ServerMember.findOneAndUpdate({ serverId, userId }, { muted: !!muted });
    res.json({ success: true, message: muted ? 'Member muted' : 'Member unmuted' });
  } catch (err) {
    console.error('[servers/mute]', err);
    res.status(500).json({ success: false, message: 'Failed to mute member' });
  }
});

module.exports = router;
