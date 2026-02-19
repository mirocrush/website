const express = require('express');
const jwt     = require('jsonwebtoken');
const Pusher  = require('pusher');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../db');
const upload    = require('../middleware/upload');
const User               = require('../models/User');
const Conversation       = require('../models/Conversation');
const ConversationMember = require('../models/ConversationMember');
const ServerMember       = require('../models/ServerMember');
const Message            = require('../models/Message');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

async function canAccessConversation(userId, conv) {
  if (conv.type === 'dm') {
    const mem = await ConversationMember.findOne({ conversationId: conv._id, userId });
    return !!mem;
  }
  if (conv.type === 'channel') {
    const sm = await ServerMember.findOne({ serverId: conv.serverId, userId });
    return !!sm;
  }
  return false;
}

function publicMessage(msg, sender) {
  return {
    id:               msg._id,
    conversationId:   msg.conversationId,
    content:          msg.kind === 'deleted' ? '' : msg.content,
    kind:             msg.kind,
    replyToMessageId: msg.replyToMessageId || null,
    attachments:      msg.attachments || [],
    editedAt:         msg.editedAt    || null,
    deletedAt:        msg.deletedAt   || null,
    createdAt:        msg.createdAt,
    sender: sender ? {
      id:          sender._id,
      username:    sender.username,
      displayName: sender.displayName,
      avatarUrl:   sender.avatarUrl || null,
    } : null,
  };
}

// POST /api/messages/list
router.post('/list', async (req, res) => {
  const { conversationId, limit = 50, cursor } = req.body;
  if (!conversationId) return res.status(400).json({ success: false, message: 'conversationId is required' });
  try {
    const me   = await requireAuth(req, res);
    if (!me) return;
    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!(await canAccessConversation(me._id, conv)))
      return res.status(403).json({ success: false, message: 'Access denied' });

    const query = { conversationId };
    if (cursor?.beforeCreatedAt) {
      query.createdAt = { $lt: new Date(cursor.beforeCreatedAt) };
    }

    const cap   = Math.min(Number(limit) || 50, 100);
    const msgs  = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(cap + 1);

    const hasMore   = msgs.length > cap;
    const slice     = hasMore ? msgs.slice(0, cap) : msgs;
    const senderIds = [...new Set(slice.map((m) => m.senderUserId.toString()))];
    const senders   = await User.find({ _id: { $in: senderIds } }).select('username displayName avatarUrl');
    const senderMap = Object.fromEntries(senders.map((s) => [s._id.toString(), s]));

    const data = slice.map((m) => publicMessage(m, senderMap[m.senderUserId.toString()]));

    const nextCursor = hasMore ? {
      beforeCreatedAt: slice[slice.length - 1].createdAt.toISOString(),
    } : null;

    res.json({ success: true, data, nextCursor });
  } catch (err) {
    console.error('[messages/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list messages' });
  }
});

// POST /api/messages/send
router.post('/send', async (req, res) => {
  const { conversationId, content = '', replyToMessageId = null, attachments = [] } = req.body;
  if (!conversationId) return res.status(400).json({ success: false, message: 'conversationId is required' });
  if (!content.trim() && attachments.length === 0)
    return res.status(400).json({ success: false, message: 'Message must have content or attachment' });
  try {
    const me   = await requireAuth(req, res);
    if (!me) return;
    const conv = await Conversation.findById(conversationId);
    if (!conv) return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (!(await canAccessConversation(me._id, conv)))
      return res.status(403).json({ success: false, message: 'Access denied' });

    const kind = attachments.length > 0
      ? (attachments[0].mimeType?.startsWith('image/') ? 'image' : 'file')
      : 'text';

    const msg = await Message.create({
      conversationId,
      senderUserId: me._id,
      content:      content.trim(),
      kind,
      replyToMessageId: replyToMessageId || null,
      attachments,
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessageId: msg._id,
      lastMessageAt: msg.createdAt,
    });

    const payload = publicMessage(msg, me);
    await pusher.trigger(`private-conv-${conversationId}`, 'message:new', payload);

    res.status(201).json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages/send]', err);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// POST /api/messages/edit
router.post('/edit', async (req, res) => {
  const { messageId, content } = req.body;
  if (!messageId || !content?.trim())
    return res.status(400).json({ success: false, message: 'messageId and content are required' });
  try {
    const me  = await requireAuth(req, res);
    if (!me) return;
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!msg.senderUserId.equals(me._id))
      return res.status(403).json({ success: false, message: 'Not your message' });
    if (msg.kind === 'deleted')
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted message' });

    msg.content  = content.trim();
    msg.editedAt = new Date();
    await msg.save();

    const payload = { messageId: msg._id, content: msg.content, editedAt: msg.editedAt };
    await pusher.trigger(`private-conv-${msg.conversationId}`, 'message:edited', payload);

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages/edit]', err);
    res.status(500).json({ success: false, message: 'Failed to edit message' });
  }
});

// POST /api/messages/delete
router.post('/delete', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ success: false, message: 'messageId is required' });
  try {
    const me  = await requireAuth(req, res);
    if (!me) return;
    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (!msg.senderUserId.equals(me._id))
      return res.status(403).json({ success: false, message: 'Not your message' });

    msg.kind      = 'deleted';
    msg.content   = '';
    msg.deletedAt = new Date();
    await msg.save();

    const payload = { messageId: msg._id, deletedAt: msg.deletedAt };
    await pusher.trigger(`private-conv-${msg.conversationId}`, 'message:deleted', payload);

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error('[messages/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete message' });
  }
});

// POST /api/messages/upload  — upload one attachment (JWT-authed, server-side Supabase)
router.post('/upload', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;

  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });

    const { mimetype, buffer, originalname, size } = req.file;
    const ext      = originalname.split('.').pop().toLowerCase();
    const filePath = `messenger/${uuidv4()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, buffer, { contentType: mimetype, upsert: false });

    if (uploadError) return res.status(500).json({ success: false, message: uploadError.message });

    const { data } = supabase.storage.from('attachments').getPublicUrl(filePath);

    res.json({
      success: true,
      data: { url: data.publicUrl, name: originalname, mimeType: mimetype, size },
    });
  });
});

module.exports = router;
