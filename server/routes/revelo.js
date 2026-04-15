const express              = require('express');
const jwt                  = require('jsonwebtoken');
const multer               = require('multer');
const { createClient }     = require('@supabase/supabase-js');
const { v4: uuidv4 }       = require('uuid');
const connectDB            = require('../db');

// ─── Supabase client (server-side) ───────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Multer — memory storage only, no filesystem ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const User = require('../models/User');
    const user = await User.findById(payload.userId);
    if (!user) { res.status(401).json({ success: false, message: 'User not found' }); return null; }
    return user;
  } catch { res.status(401).json({ success: false, message: 'Invalid token' }); return null; }
}

// ─── ACCOUNTS ────────────────────────────────────────────────────────────────

// POST /api/revelo/accounts/list
router.post('/accounts/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    require('../models/ReveloJob'); // ensure model is registered before populate
    const ReveloAccount = require('../models/ReveloAccount');
    const accounts = await ReveloAccount.find({ userId: user._id })
      .populate('attachedJobs', 'jobName')
      .sort({ createdAt: -1 });
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/accounts/create
router.post('/accounts/create', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloAccount = require('../models/ReveloAccount');
    const { name, nationality, createdDate, connectionType, proxyDetail, remotePc, paymentDetails, statuses } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'name is required' });
    const account = await ReveloAccount.create({
      userId: user._id,
      name,
      nationality: nationality || '',
      createdDate: createdDate || Date.now(),
      connectionType: connectionType || 'proxy',
      proxyDetail: proxyDetail || {},
      remotePc: remotePc || {},
      paymentDetails: paymentDetails || {},
      statuses: statuses || [],
    });
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/accounts/update
router.post('/accounts/update', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloAccount = require('../models/ReveloAccount');
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const account = await ReveloAccount.findById(id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (!account.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    const allowed = ['name', 'nationality', 'createdDate', 'connectionType', 'proxyDetail', 'remotePc', 'paymentDetails', 'statuses', 'attachedJobs'];
    allowed.forEach(k => { if (updates[k] !== undefined) account[k] = updates[k]; });
    await account.save();
    res.json({ success: true, account });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/accounts/delete
router.post('/accounts/delete', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloAccount = require('../models/ReveloAccount');
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const account = await ReveloAccount.findById(id);
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (!account.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    await account.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── ASSETS ───────────────────────────────────────────────────────────────────

// POST /api/revelo/assets/upload
router.post('/assets/upload', upload.array('files', 20), async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No files received' });

    const results = await Promise.all(req.files.map(async (f) => {
      const ext      = f.originalname.split('.').pop().toLowerCase();
      const filePath = `revelo/${user._id}/${uuidv4()}.${ext}`;

      const { error } = await supabase.storage
        .from('revelo-assets')
        .upload(filePath, f.buffer, { contentType: f.mimetype, upsert: false });

      if (error) throw new Error(error.message);

      const { data } = supabase.storage.from('revelo-assets').getPublicUrl(filePath);

      return { name: f.originalname, url: data.publicUrl, size: f.size, mimetype: f.mimetype };
    }));

    res.json({ success: true, files: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── JOBS ─────────────────────────────────────────────────────────────────────

// POST /api/revelo/jobs/list
router.post('/jobs/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const jobs = await ReveloJob.find()
      .populate('creatorId', 'displayName username')
      .sort({ createdAt: -1 });
    res.json({ success: true, jobs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/jobs/create
router.post('/jobs/create', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const {
      jobName, jobMaxDuration, jobMaxPayableTime, jobExpectedTime,
      hourlyRate, jobDescription, leaders, assets, term, learningCurve, status, startDate,
    } = req.body;
    if (!jobName) return res.status(400).json({ success: false, message: 'jobName is required' });
    const job = await ReveloJob.create({
      creatorId: user._id,
      creatorName: user.displayName || user.username,
      jobName, jobMaxDuration, jobMaxPayableTime, jobExpectedTime,
      hourlyRate, jobDescription, leaders, assets: assets || [], term, learningCurve, status,
      startDate: startDate || Date.now(),
    });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/jobs/update
router.post('/jobs/update', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const job = await ReveloJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (!job.creatorId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    const allowed = [
      'jobName', 'jobMaxDuration', 'jobMaxPayableTime', 'jobExpectedTime',
      'hourlyRate', 'jobDescription', 'leaders', 'assets', 'term', 'learningCurve', 'status', 'startDate',
    ];
    allowed.forEach(k => { if (updates[k] !== undefined) job[k] = updates[k]; });
    await job.save();
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/jobs/delete
router.post('/jobs/delete', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const job = await ReveloJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (!job.creatorId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    await job.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/jobs/request-edit
router.post('/jobs/request-edit', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const { jobId, changes, message } = req.body;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId is required' });
    const job = await ReveloJob.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (job.creatorId.equals(user._id))
      return res.status(400).json({ success: false, message: 'Cannot request edit on own job' });
    job.editRequests.push({
      requesterId: user._id,
      requesterName: user.displayName || user.username,
      changes: changes || {},
      message: message || '',
      status: 'pending',
      createdAt: new Date(),
    });
    await job.save();
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/jobs/handle-edit-request
router.post('/jobs/handle-edit-request', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const { jobId, requestId, action } = req.body;
    if (!jobId || !requestId || !action)
      return res.status(400).json({ success: false, message: 'jobId, requestId, action required' });
    const job = await ReveloJob.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (!job.creatorId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    const request = job.editRequests.id(requestId);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (action === 'accept') {
      const allowed = [
        'jobName', 'jobMaxDuration', 'jobMaxPayableTime', 'jobExpectedTime',
        'hourlyRate', 'jobDescription', 'leaders', 'assets', 'term', 'learningCurve', 'status',
      ];
      const changes = request.changes || {};
      allowed.forEach(k => { if (changes[k] !== undefined) job[k] = changes[k]; });
      request.status = 'accepted';
    } else if (action === 'reject') {
      request.status = 'rejected';
    } else {
      return res.status(400).json({ success: false, message: 'action must be accept or reject' });
    }
    await job.save();
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── TASKS ────────────────────────────────────────────────────────────────────

// POST /api/revelo/tasks/list
router.post('/tasks/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTask = require('../models/ReveloTask');
    const { search, status, sort, page = 1, limit = 10 } = req.body;
    const filter = { userId: user._id };
    if (status) filter.status = status;

    let query = ReveloTask.find(filter)
      .populate('accountId', 'name nationality')
      .populate('jobId', 'jobName hourlyRate status');

    if (sort === 'oldest') {
      query = query.sort({ createdAt: 1 });
    } else if (sort === 'start-date') {
      query = query.sort({ startDate: -1 });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    let tasks = await query;

    if (search) {
      const s = search.toLowerCase();
      tasks = tasks.filter(t =>
        (t.accountId?.name || '').toLowerCase().includes(s) ||
        (t.jobId?.jobName || '').toLowerCase().includes(s)
      );
    }

    const total = tasks.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const paginated = tasks.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({ success: true, tasks: paginated, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/tasks/create
router.post('/tasks/create', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTask = require('../models/ReveloTask');
    const { accountId, jobId, startDate, status } = req.body;
    if (!accountId || !jobId)
      return res.status(400).json({ success: false, message: 'accountId and jobId are required' });
    const task = await ReveloTask.create({
      userId: user._id,
      accountId,
      jobId,
      startDate: startDate || undefined,
      status: status || 'pending',
    });
    const populated = await task.populate([
      { path: 'accountId', select: 'name nationality' },
      { path: 'jobId', select: 'jobName hourlyRate status' },
    ]);
    res.json({ success: true, task: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/tasks/update
router.post('/tasks/update', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTask = require('../models/ReveloTask');
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const task = await ReveloTask.findById(id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!task.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    const allowed = ['accountId', 'jobId', 'startDate', 'status'];
    allowed.forEach(k => { if (updates[k] !== undefined) task[k] = updates[k]; });
    await task.save();
    const populated = await task.populate([
      { path: 'accountId', select: 'name nationality' },
      { path: 'jobId', select: 'jobName hourlyRate status' },
    ]);
    res.json({ success: true, task: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/tasks/delete
router.post('/tasks/delete', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTask = require('../models/ReveloTask');
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const task = await ReveloTask.findById(id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!task.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    await task.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

// POST /api/revelo/dashboard/stats
router.post('/dashboard/stats', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloAccount = require('../models/ReveloAccount');
    const ReveloJob     = require('../models/ReveloJob');
    const ReveloTask    = require('../models/ReveloTask');

    const [totalAccounts, totalJobs, totalTasks, allTasks, recentTasksDocs] = await Promise.all([
      ReveloAccount.countDocuments({ userId: user._id }),
      ReveloJob.countDocuments(),
      ReveloTask.countDocuments({ userId: user._id }),
      ReveloTask.find({ userId: user._id }).select('status'),
      ReveloTask.find({ userId: user._id })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('accountId', 'name nationality')
        .populate('jobId', 'jobName hourlyRate'),
    ]);

    const tasksByStatus = { pending: 0, active: 0, completed: 0, cancelled: 0 };
    allTasks.forEach(t => { if (tasksByStatus[t.status] !== undefined) tasksByStatus[t.status]++; });

    // Top 3 jobs by task count (for this user)
    const jobCounts = {};
    const allUserTasks = await ReveloTask.find({ userId: user._id }).select('jobId');
    allUserTasks.forEach(t => {
      const jid = t.jobId.toString();
      jobCounts[jid] = (jobCounts[jid] || 0) + 1;
    });
    const sorted = Object.entries(jobCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topJobIds = sorted.map(([id]) => id);
    const topJobDocs = await ReveloJob.find({ _id: { $in: topJobIds } }).select('jobName hourlyRate status');
    const topJobs = sorted.map(([id, count]) => {
      const job = topJobDocs.find(j => j._id.toString() === id);
      return { job, count };
    });

    res.json({
      success: true,
      totalAccounts,
      totalJobs,
      totalTasks,
      tasksByStatus,
      recentTasks: recentTasksDocs,
      topJobs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── FORUM ────────────────────────────────────────────────────────────────────

// POST /api/revelo/forum/list  { jobId, page=1, limit=10 }
router.post('/forum/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloForumMessage = require('../models/ReveloForumMessage');
    const { jobId, page = 1, limit = 10 } = req.body;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await ReveloForumMessage.countDocuments({ jobId, parentId: null });
    const topLevel = await ReveloForumMessage.find({ jobId, parentId: null })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const messages = await Promise.all(topLevel.map(async (msg) => {
      const replies = await ReveloForumMessage.find({ parentId: msg._id })
        .sort({ createdAt: 1 });
      return { ...msg.toJSON(), replies: replies.map(r => r.toJSON()) };
    }));

    res.json({ success: true, messages, total, page: parseInt(page), limit: parseInt(limit),
      hasMore: skip + messages.length < total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/forum/send
router.post('/forum/send', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloForumMessage = require('../models/ReveloForumMessage');
    const { jobId, content, files, parentId } = req.body;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId required' });

    const msg = await ReveloForumMessage.create({
      jobId, userId: user._id,
      userName: user.displayName || user.username,
      content: content || '',
      files:   files   || [],
      parentId: parentId || null,
    });
    const result = { ...msg.toJSON(), replies: [] };
    res.json({ success: true, message: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/forum/react  { messageId, type: 'thumbUp'|'thumbDown'|'emoji', emoji? }
router.post('/forum/react', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloForumMessage = require('../models/ReveloForumMessage');
    const { messageId, type, emoji } = req.body;
    if (!messageId || !type) return res.status(400).json({ success: false, message: 'messageId and type required' });

    const msg = await ReveloForumMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });

    const userId   = user._id;
    const userName = user.displayName || user.username;

    if (type === 'thumbUp' || type === 'thumbDown') {
      const arr  = msg[type];
      const idx  = arr.findIndex(r => r.userId.toString() === userId.toString());
      if (idx >= 0) arr.splice(idx, 1);
      else          arr.push({ userId, userName });
      // Remove from opposite
      const opp    = type === 'thumbUp' ? 'thumbDown' : 'thumbUp';
      const oppIdx = msg[opp].findIndex(r => r.userId.toString() === userId.toString());
      if (oppIdx >= 0) msg[opp].splice(oppIdx, 1);
    } else if (type === 'emoji' && emoji) {
      let entry = msg.emojis.find(e => e.emoji === emoji);
      if (!entry) {
        msg.emojis.push({ emoji, users: [{ userId, userName }] });
      } else {
        const ui = entry.users.findIndex(u => u.userId.toString() === userId.toString());
        if (ui >= 0) entry.users.splice(ui, 1);
        else         entry.users.push({ userId, userName });
        msg.emojis = msg.emojis.filter(e => e.users.length > 0);
      }
    }

    await msg.save();
    const replies = await ReveloForumMessage.find({ parentId: msg._id }).sort({ createdAt: 1 });
    res.json({ success: true, message: { ...msg.toJSON(), replies: replies.map(r => r.toJSON()) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/forum/upload
router.post('/forum/upload', upload.array('files', 10), async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!req.files?.length) return res.status(400).json({ success: false, message: 'No files' });

    const now = new Date();
    const results = await Promise.all(req.files.map(async (f) => {
      const ext      = f.originalname.split('.').pop().toLowerCase();
      const filePath = `revelo/forum/${user._id}/${uuidv4()}.${ext}`;
      const { error } = await supabase.storage
        .from('revelo-assets')
        .upload(filePath, f.buffer, { contentType: f.mimetype, upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from('revelo-assets').getPublicUrl(filePath);
      return { name: f.originalname, url: data.publicUrl, size: f.size, mimetype: f.mimetype, uploadedAt: now };
    }));

    res.json({ success: true, files: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
