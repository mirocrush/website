const express      = require('express');
const jwt          = require('jsonwebtoken');
const connectDB    = require('../db');
const User         = require('../models/User');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload      = jwt.verify(token, process.env.JWT_SECRET);
    const user         = await User.findById(payload.userId);
    const sessionAlive = user?.activeSessions?.some(s => s.sessionId === payload.sessionId);
    if (!user || !sessionAlive) {
      res.status(401).json({ success: false, message: 'Session expired' }); return null;
    }
    return user;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid session' }); return null;
  }
}

// POST /api/notifications/list
// Returns recent notifications for the current user.
// Body: { page?, limit?, unreadOnly? }
router.post('/list', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const page       = Math.max(1, parseInt(req.body.page)  || 1);
  const limit      = Math.min(100, parseInt(req.body.limit) || 30);
  const unreadOnly = req.body.unreadOnly === true || req.body.unreadOnly === 'true';

  const filter = { userId: me._id };
  if (unreadOnly) filter.read = false;

  try {
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean({ virtuals: true }),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: me._id, read: false }),
    ]);

    res.json({ success: true, data: notifications, total, unreadCount });
  } catch (err) {
    console.error('[notifications/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list notifications' });
  }
});

// POST /api/notifications/unread-count
// Returns just the unread notification count. Lightweight — used for polling.
router.post('/unread-count', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  try {
    const count = await Notification.countDocuments({ userId: me._id, read: false });
    res.json({ success: true, count });
  } catch (err) {
    console.error('[notifications/unread-count]', err);
    res.status(500).json({ success: false, message: 'Failed to get count' });
  }
});

// POST /api/notifications/mark-read
// Marks specific notifications as read.
// Body: { ids: [id, ...] }
router.post('/mark-read', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'ids array is required' });
  }

  try {
    await Notification.updateMany(
      { _id: { $in: ids }, userId: me._id },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications/mark-read]', err);
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

// POST /api/notifications/mark-all-read
// Marks all notifications for the current user as read.
router.post('/mark-all-read', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  try {
    await Notification.updateMany({ userId: me._id, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    console.error('[notifications/mark-all-read]', err);
    res.status(500).json({ success: false, message: 'Failed to mark all as read' });
  }
});

// GET /api/notifications/events
// Server-Sent Events stream — pushes new unread notifications to the client in real time.
// Authentication via httpOnly cookie (sent automatically by the browser).
// Uses Last-Event-ID header (ISO timestamp) as a cursor so the client never misses events
// across reconnects. Times out after 25 s (safe for Vercel 30 s limit) and the browser's
// native EventSource reconnects automatically.
router.get('/events', async (req, res) => {
  // Auth via cookie (EventSource sends cookies automatically)
  const token = req.cookies?.token;
  if (!token) { res.status(401).end(); return; }

  let userId;
  try {
    const payload      = jwt.verify(token, process.env.JWT_SECRET);
    const user         = await User.findById(payload.userId).select('_id activeSessions');
    const sessionAlive = user?.activeSessions?.some(s => s.sessionId === payload.sessionId);
    if (!user || !sessionAlive) { res.status(401).end(); return; }
    userId = user._id;
  } catch {
    res.status(401).end();
    return;
  }

  // Set SSE headers
  res.set({
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no', // disable nginx buffering
  });
  res.flushHeaders();

  // Cursor: use Last-Event-ID (sent by EventSource on reconnect) or "now"
  const lastId   = req.headers['last-event-id'];
  let   since    = lastId ? new Date(lastId) : new Date();

  const send = (eventName, data) => {
    res.write(`event: ${eventName}\n`);
    res.write(`id: ${new Date().toISOString()}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send immediate unread count so the UI reflects reality on connect
  try {
    const count = await Notification.countDocuments({ userId, read: false });
    send('count', { count });
  } catch { /* ignore */ }

  // Poll for new notifications every 3 s
  const POLL_MS    = 3_000;
  const TIMEOUT_MS = 25_000; // close before Vercel's 30 s limit
  let   elapsed    = 0;

  const timer = setInterval(async () => {
    elapsed += POLL_MS;

    try {
      const newNotifs = await Notification.find({
        userId,
        createdAt: { $gt: since },
      }).sort({ createdAt: 1 }).limit(20).lean({ virtuals: true });

      if (newNotifs.length) {
        since = new Date(newNotifs[newNotifs.length - 1].createdAt);
        for (const n of newNotifs) {
          send('notification', n);
        }
        // Also send updated unread count
        const count = await Notification.countDocuments({ userId, read: false });
        send('count', { count });
      }
    } catch { /* ignore — client will reconnect */ }

    // Keep-alive ping
    res.write(': ping\n\n');

    if (elapsed >= TIMEOUT_MS) {
      clearInterval(timer);
      res.end(); // client reconnects automatically
    }
  }, POLL_MS);

  // Clean up if client disconnects early
  req.on('close', () => clearInterval(timer));
});

module.exports = router;
