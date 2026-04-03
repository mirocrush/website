const express = require('express');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../db');
const User    = require('../models/User');
const Profile = require('../models/Profile');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const pictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(payload.userId);
    const sessionAlive = user?.activeSessions?.some(s => s.sessionId === payload.sessionId);
    if (!user || !sessionAlive) {
      res.status(401).json({ success: false, message: 'Session expired' }); return null;
    }
    return user;
  } catch {
    res.status(401).json({ success: false, message: 'Invalid session' }); return null;
  }
}

// GET /api/profiles — list my profiles
router.get('/', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  try {
    const profiles = await Profile.find({ userId: me._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: profiles });
  } catch (err) {
    console.error('[profiles/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list profiles' });
  }
});

// POST /api/profiles/create
router.post('/create', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { name, nationality, expertEmail } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'name is required' });
  try {
    const profile = await Profile.create({
      userId:      me._id,
      name:        name.trim(),
      nationality: nationality?.trim() || null,
      expertEmail: expertEmail?.trim() || null,
    });
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    console.error('[profiles/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create profile' });
  }
});

// POST /api/profiles/update
router.post('/update', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id, name, nationality, expertEmail } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const profile = await Profile.findById(id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (profile.userId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your profile' });
    }
    const update = {};
    if (name        !== undefined) {
      if (!name.trim()) return res.status(400).json({ success: false, message: 'name cannot be empty' });
      update.name = name.trim();
    }
    if (nationality !== undefined) update.nationality = nationality?.trim() || null;
    if (expertEmail !== undefined) update.expertEmail = expertEmail?.trim() || null;
    const updated = await Profile.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[profiles/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// POST /api/profiles/delete
router.post('/delete', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const profile = await Profile.findById(id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (profile.userId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your profile' });
    }
    if (profile.picturePath) {
      await supabase.storage.from('profile-pictures').remove([profile.picturePath]);
    }
    await Profile.findByIdAndDelete(id);
    res.json({ success: true, message: 'Profile deleted' });
  } catch (err) {
    console.error('[profiles/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete profile' });
  }
});

// POST /api/profiles/upload-picture — multipart/form-data: picture (file), id (field)
router.post('/upload-picture', (req, res) => {
  pictureUpload.single('picture')(req, res, async (multerErr) => {
    if (multerErr) return res.status(400).json({ success: false, message: multerErr.message });
    const me = await requireAuth(req, res);
    if (!me) return;
    const { id } = req.body;
    if (!id) return res.status(400).json({ success: false, message: 'id is required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });
    try {
      const profile = await Profile.findById(id);
      if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
      if (profile.userId.toString() !== me._id.toString()) {
        return res.status(403).json({ success: false, message: 'Not your profile' });
      }
      if (profile.picturePath) {
        await supabase.storage.from('profile-pictures').remove([profile.picturePath]);
      }
      const ext      = req.file.originalname.split('.').pop().toLowerCase();
      const filePath = `pictures/${uuidv4()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
      if (uploadErr) return res.status(500).json({ success: false, message: uploadErr.message });
      const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath);
      const updated = await Profile.findByIdAndUpdate(
        id, { pictureUrl: data.publicUrl, picturePath: filePath }, { new: true }
      );
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('[profiles/upload-picture]', err);
      res.status(500).json({ success: false, message: 'Failed to upload picture' });
    }
  });
});

// POST /api/profiles/delete-picture
router.post('/delete-picture', async (req, res) => {
  const me = await requireAuth(req, res);
  if (!me) return;
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const profile = await Profile.findById(id);
    if (!profile) return res.status(404).json({ success: false, message: 'Profile not found' });
    if (profile.userId.toString() !== me._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not your profile' });
    }
    if (profile.picturePath) {
      await supabase.storage.from('profile-pictures').remove([profile.picturePath]);
    }
    const updated = await Profile.findByIdAndUpdate(
      id, { pictureUrl: null, picturePath: null }, { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[profiles/delete-picture]', err);
    res.status(500).json({ success: false, message: 'Failed to delete picture' });
  }
});

module.exports = router;
