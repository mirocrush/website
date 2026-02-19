const express = require('express');
const jwt     = require('jsonwebtoken');
const connectDB = require('../db');
const User          = require('../models/User');
const FriendRequest = require('../models/FriendRequest');

const router = express.Router();

router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// ── Helper ────────────────────────────────────────────────────────────────────

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
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

function publicUser(u) {
  return { id: u._id || u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl || null };
}

// ── POST /api/friends/send ────────────────────────────────────────────────────

router.post('/send', async (req, res) => {
  const { query } = req.body; // email or username
  if (!query) return res.status(400).json({ success: false, message: 'query (email or username) is required' });

  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    // Find target by email or username
    const isEmail  = query.includes('@');
    const target   = isEmail
      ? await User.findOne({ email: query.toLowerCase() })
      : await User.findOne({ username: query.toLowerCase() });

    if (!target) return res.status(404).json({ success: false, message: 'User not found' });
    if (target._id.equals(me._id)) return res.status(400).json({ success: false, message: 'You cannot send a friend request to yourself' });

    // Check for any existing request in either direction
    const existing = await FriendRequest.findOne({
      $or: [
        { senderId: me._id, receiverId: target._id },
        { senderId: target._id, receiverId: me._id },
      ],
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return res.status(409).json({ success: false, message: 'You are already friends' });
      }
      if (existing.status === 'pending') {
        return res.status(409).json({ success: false, message: 'A friend request already exists' });
      }
      // Denied — delete stale document and create a fresh one in the correct direction
      await FriendRequest.deleteOne({ _id: existing._id });
    }

    await FriendRequest.create({ senderId: me._id, receiverId: target._id });
    res.json({ success: true, message: 'Friend request sent' });
  } catch (err) {
    console.error('[friends/send]', err);
    res.status(500).json({ success: false, message: 'Failed to send friend request' });
  }
});

// ── POST /api/friends/respond ─────────────────────────────────────────────────

router.post('/respond', async (req, res) => {
  const { requestId, action } = req.body;
  if (!requestId || !action) return res.status(400).json({ success: false, message: 'requestId and action are required' });
  if (!['accept', 'deny'].includes(action)) return res.status(400).json({ success: false, message: 'action must be accept or deny' });

  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const request = await FriendRequest.findById(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (!request.receiverId.equals(me._id)) return res.status(403).json({ success: false, message: 'Not authorized' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Request is no longer pending' });

    request.status = action === 'accept' ? 'accepted' : 'denied';
    await request.save();

    res.json({ success: true, message: action === 'accept' ? 'Friend request accepted' : 'Friend request denied' });
  } catch (err) {
    console.error('[friends/respond]', err);
    res.status(500).json({ success: false, message: 'Failed to respond to request' });
  }
});

// ── POST /api/friends/requests ────────────────────────────────────────────────

router.post('/requests', async (req, res) => {
  const { type } = req.body; // 'received' | 'sent'
  if (!type || !['received', 'sent'].includes(type)) {
    return res.status(400).json({ success: false, message: 'type must be received or sent' });
  }

  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const query = type === 'received'
      ? { receiverId: me._id, status: 'pending' }
      : { senderId:   me._id, status: 'pending' };

    const requests = await FriendRequest.find(query)
      .populate('senderId',   'displayName username avatarUrl')
      .populate('receiverId', 'displayName username avatarUrl')
      .sort({ createdAt: -1 });

    const data = requests.map((r) => ({
      id:        r._id,
      status:    r.status,
      createdAt: r.createdAt,
      sender:    publicUser(r.senderId),
      receiver:  publicUser(r.receiverId),
    }));

    res.json({ success: true, data });
  } catch (err) {
    console.error('[friends/requests]', err);
    res.status(500).json({ success: false, message: 'Failed to load requests' });
  }
});

// ── POST /api/friends/list ────────────────────────────────────────────────────

router.post('/list', async (req, res) => {
  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const friendships = await FriendRequest.find({
      $or: [{ senderId: me._id }, { receiverId: me._id }],
      status: 'accepted',
    })
      .populate('senderId',   'displayName username avatarUrl')
      .populate('receiverId', 'displayName username avatarUrl');

    const friends = friendships
      .map((f) => {
        // Guard against deleted users (populate returns null if user no longer exists)
        if (!f.senderId || !f.receiverId) return null;
        const friend = f.senderId._id.equals(me._id) ? f.receiverId : f.senderId;
        return { requestId: f._id, ...publicUser(friend) };
      })
      .filter(Boolean);

    res.json({ success: true, data: friends });
  } catch (err) {
    console.error('[friends/list]', err);
    res.status(500).json({ success: false, message: 'Failed to load friends' });
  }
});

// ── POST /api/friends/remove ──────────────────────────────────────────────────

router.post('/remove', async (req, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ success: false, message: 'friendId is required' });

  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const deleted = await FriendRequest.findOneAndDelete({
      $or: [
        { senderId: me._id,   receiverId: friendId },
        { senderId: friendId, receiverId: me._id },
      ],
      status: 'accepted',
    });

    if (!deleted) return res.status(404).json({ success: false, message: 'Friendship not found' });
    res.json({ success: true, message: 'Friend removed' });
  } catch (err) {
    console.error('[friends/remove]', err);
    res.status(500).json({ success: false, message: 'Failed to remove friend' });
  }
});

// ── POST /api/friends/status ──────────────────────────────────────────────────

router.post('/status', async (req, res) => {
  const { otherUserId } = req.body;
  if (!otherUserId) return res.status(400).json({ success: false, message: 'otherUserId is required' });

  try {
    const me = await requireAuth(req, res);
    if (!me) return;

    const request = await FriendRequest.findOne({
      $or: [
        { senderId: me._id,      receiverId: otherUserId },
        { senderId: otherUserId, receiverId: me._id },
      ],
    });

    if (!request) return res.json({ success: true, data: { status: 'none' } });
    if (request.status === 'accepted') return res.json({ success: true, data: { status: 'friends', requestId: request._id } });
    if (request.status === 'pending') {
      const isSent = request.senderId.equals(me._id);
      return res.json({ success: true, data: {
        status: isSent ? 'pending_sent' : 'pending_received',
        requestId: request._id,
      }});
    }
    res.json({ success: true, data: { status: 'none' } });
  } catch (err) {
    console.error('[friends/status]', err);
    res.status(500).json({ success: false, message: 'Failed to get friend status' });
  }
});

module.exports = router;
