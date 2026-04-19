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
    const ReveloJob = require('../models/ReveloJob');
    const { targetUsername } = req.body;
    let targetUserId = user._id;
    if (targetUsername) {
      const User = require('../models/User');
      const target = await User.findOne({ username: targetUsername });
      if (!target) return res.status(404).json({ success: false, message: 'User not found' });
      targetUserId = target._id;
    }
    const accounts = await ReveloAccount.find({ userId: targetUserId }).sort({ createdAt: -1 });
    const accountIds = accounts.map(a => a._id);
    const jobCounts = await ReveloJob.aggregate([
      { $match: { accountId: { $in: accountIds } } },
      { $group: { _id: '$accountId', count: { $sum: 1 } } },
    ]);
    const jobCountMap = {};
    jobCounts.forEach(c => { jobCountMap[c._id.toString()] = c.count; });
    const accountsOut = accounts.map(a => ({
      ...a.toJSON(),
      jobCount: jobCountMap[a._id.toString()] || 0,
    }));
    res.json({ success: true, accounts: accountsOut });
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
    const ReveloForumMessage = require('../models/ReveloForumMessage');
    const { accountId: filterAccountId } = req.body;
    const filter = filterAccountId ? { accountId: filterAccountId } : {};
    const jobs = await ReveloJob.find(filter)
      .populate('creatorId', 'displayName username')
      .sort({ createdAt: -1 });
    // Batch-load forum message counts
    const jobIds = jobs.map(j => j._id);
    const counts = await ReveloForumMessage.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: '$jobId', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });
    const ReveloTaskBalance = require('../models/ReveloTaskBalance');
    const submittedAgg = await ReveloTaskBalance.aggregate([
      { $match: { jobId: { $in: jobIds }, type: 'submitted' } },
      { $group: { _id: '$jobId', total: { $sum: '$count' } } },
    ]);
    const submittedMap = {};
    submittedAgg.forEach(s => { submittedMap[s._id.toString()] = s.total; });
    const jobsWithCount = jobs.map(j => ({
      ...j.toJSON(),
      forumCount:     countMap[j._id.toString()]     || 0,
      submittedCount: submittedMap[j._id.toString()] || 0,
    }));
    res.json({ success: true, jobs: jobsWithCount });
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
      accountId, jobName, jobMaxDuration, jobMaxPayableTime, jobExpectedTime,
      hourlyRate, jobDescription, leaders, assets, term, learningCurve, status, startDate,
    } = req.body;
    if (!jobName) return res.status(400).json({ success: false, message: 'jobName is required' });
    const job = await ReveloJob.create({
      creatorId: user._id,
      creatorName: user.displayName || user.username,
      accountId: accountId || null,
      jobName, jobMaxDuration, jobMaxPayableTime, jobExpectedTime,
      hourlyRate, jobDescription, leaders, assets: assets || [], term, learningCurve, status,
      startDate: startDate || Date.now(),
    });
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/jobs/set-account  — link/unlink a job to an account (no creator check)
router.post('/jobs/set-account', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloJob = require('../models/ReveloJob');
    const { id, accountId } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const job = await ReveloJob.findById(id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    job.accountId = accountId || null;
    await job.save();
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
      'accountId', 'jobName', 'jobMaxDuration', 'jobMaxPayableTime', 'jobExpectedTime',
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
    require('../models/ReveloAccount'); // ensure model is registered before populate
    require('../models/ReveloJob');     // ensure model is registered before populate
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

// POST /api/revelo/tasks/upload
router.post('/tasks/upload', upload.array('files', 20), async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No files received' });

    const now = new Date();
    const results = await Promise.all(req.files.map(async (f) => {
      const ext      = f.originalname.split('.').pop().toLowerCase();
      const filePath = `tasks/${user._id}/${uuidv4()}.${ext}`;

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

// POST /api/revelo/tasks/create
router.post('/tasks/create', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTask = require('../models/ReveloTask');
    require('../models/ReveloAccount');
    require('../models/ReveloJob');
    const { accountId, jobId, taskUuid, duration, comment, feedback, startDate, status, attachments } = req.body;
    if (!accountId || !jobId)
      return res.status(400).json({ success: false, message: 'accountId and jobId are required' });
    const task = await ReveloTask.create({
      userId: user._id,
      accountId,
      jobId,
      taskUuid:    taskUuid    || '',
      duration:    duration    || '',
      comment:     comment     || '',
      feedback:    feedback    || '',
      startDate:   startDate   || new Date(),
      status:      status      || 'started',
      attachments: Array.isArray(attachments) ? attachments : [],
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
    require('../models/ReveloAccount');
    require('../models/ReveloJob');
    const { id, ...updates } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const task = await ReveloTask.findById(id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
    if (!task.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    const allowed = ['accountId', 'jobId', 'taskUuid', 'duration', 'comment', 'feedback', 'startDate', 'status', 'attachments'];
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
      userName:   user.displayName || user.username,
      userAvatar: user.avatarUrl   || '',
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

// POST /api/revelo/forum/edit  { messageId, content }
router.post('/forum/edit', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloForumMessage = require('../models/ReveloForumMessage');
    const { messageId, content } = req.body;
    if (!messageId) return res.status(400).json({ success: false, message: 'messageId required' });
    const msg = await ReveloForumMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (msg.userId.toString() !== user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    msg.content = content || '';
    await msg.save();
    const replies = await ReveloForumMessage.find({ parentId: msg._id }).sort({ createdAt: 1 });
    res.json({ success: true, message: { ...msg.toJSON(), replies: replies.map(r => r.toJSON()) } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/forum/delete  { messageId }
router.post('/forum/delete', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloForumMessage = require('../models/ReveloForumMessage');
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ success: false, message: 'messageId required' });
    const msg = await ReveloForumMessage.findById(messageId);
    if (!msg) return res.status(404).json({ success: false, message: 'Message not found' });
    if (msg.userId.toString() !== user._id.toString())
      return res.status(403).json({ success: false, message: 'Not authorized' });
    // Delete replies if it's a top-level message
    if (!msg.parentId) await ReveloForumMessage.deleteMany({ parentId: msg._id });
    await msg.deleteOne();
    res.json({ success: true, messageId, parentId: msg.parentId?.toString() || null });
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

// ─── INCOME REPORTS ──────────────────────────────────────────────────────────

// JST helpers
const JST_OFFSET = 9 * 60 * 60 * 1000;
const jstDayUTC = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, d,  0,  0,  0,   0) - JST_OFFSET),
    end:   new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - JST_OFFSET),
  };
};
const todayJST = () => {
  const jst = new Date(Date.now() + JST_OFFSET);
  return `${jst.getUTCFullYear()}-${String(jst.getUTCMonth()+1).padStart(2,'0')}-${String(jst.getUTCDate()).padStart(2,'0')}`;
};

// POST /api/revelo/income-reports/list
router.post('/income-reports/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloIncomeReport = require('../models/ReveloIncomeReport');
    const { date } = req.body;
    const { start, end } = jstDayUTC(date || todayJST());
    const reports = await ReveloIncomeReport
      .find({ createdAt: { $gte: start, $lte: end } })
      .populate('userId', 'displayName username profilePicture')
      .sort({ createdAt: -1 });
    res.json({ success: true, reports, todayJST: todayJST() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/income-reports/create
router.post('/income-reports/create', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloIncomeReport = require('../models/ReveloIncomeReport');
    const { content, attachments } = req.body;
    const report = await ReveloIncomeReport.create({
      userId: user._id,
      content: content || '',
      attachments: Array.isArray(attachments) ? attachments : [],
    });
    const populated = await report.populate('userId', 'displayName username profilePicture');
    res.json({ success: true, report: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/income-reports/update
router.post('/income-reports/update', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloIncomeReport = require('../models/ReveloIncomeReport');
    const { id, content, attachments } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const report = await ReveloIncomeReport.findById(id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    if (!report.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    if (content     !== undefined) report.content     = content;
    if (attachments !== undefined) report.attachments = attachments;
    await report.save();
    const populated = await report.populate('userId', 'displayName username profilePicture');
    res.json({ success: true, report: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/income-reports/delete
router.post('/income-reports/delete', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloIncomeReport = require('../models/ReveloIncomeReport');
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const report = await ReveloIncomeReport.findById(id);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    if (!report.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    await report.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/income-reports/upload
router.post('/income-reports/upload', upload.array('files', 20), async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No files received' });
    const results = await Promise.all(req.files.map(async (f) => {
      const ext      = f.originalname.split('.').pop().toLowerCase();
      const filePath = `income-reports/${user._id}/${uuidv4()}.${ext}`;
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

// ─── TASK BALANCE ────────────────────────────────────────────────────────────

// POST /api/revelo/task-balance/add
router.post('/task-balance/add', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTaskBalance = require('../models/ReveloTaskBalance');
    const { accountId, jobId, type, count, cost, note } = req.body;
    if (!accountId || !jobId || !type || !count)
      return res.status(400).json({ success: false, message: 'accountId, jobId, type and count are required' });
    const entry = await ReveloTaskBalance.create({
      userId: user._id, accountId, jobId, type,
      count: Number(count),
      cost: cost != null && cost !== '' ? Number(cost) : null,
      note: note || '',
    });
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/task-balance/list
router.post('/task-balance/list', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTaskBalance = require('../models/ReveloTaskBalance');
    const { jobId, from, to, targetUsername } = req.body;
    if (!jobId) return res.status(400).json({ success: false, message: 'jobId is required' });
    let targetUserId = user._id;
    if (targetUsername) {
      const User = require('../models/User');
      const target = await User.findOne({ username: targetUsername });
      if (!target) return res.status(404).json({ success: false, message: 'User not found' });
      targetUserId = target._id;
    }
    const filter = { userId: targetUserId, jobId };
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to)   filter.createdAt.$lte = new Date(to);
    }
    const entries = await ReveloTaskBalance.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, entries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/task-balance/update
router.post('/task-balance/update', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTaskBalance = require('../models/ReveloTaskBalance');
    const { id, count, cost, note } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const entry = await ReveloTaskBalance.findById(id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (!entry.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    if (count != null && count !== '') entry.count = Number(count);
    entry.cost = (cost != null && cost !== '') ? Number(cost) : null;
    if (note != null) entry.note = note;
    await entry.save();
    res.json({ success: true, entry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/revelo/task-balance/delete
router.post('/task-balance/delete', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    const ReveloTaskBalance = require('../models/ReveloTaskBalance');
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    const entry = await ReveloTaskBalance.findById(id);
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    if (!entry.userId.equals(user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' });
    await entry.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
