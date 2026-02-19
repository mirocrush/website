const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const multer  = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');
const connectDB = require('../db');
const User = require('../models/User');
const PendingVerification = require('../models/PendingVerification');

const router = express.Router();
const resend  = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_MAX_AGE = 7 * 24 * 60 * 60;        // 7 days in seconds
const OTP_EXPIRY  = 5 * 60 * 1000;           // 5 minutes in ms
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// Multer for avatar uploads (images only, 5 MB)
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed for avatars'));
  },
});

router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function issueJwt(res, user) {
  const token = jwt.sign(
    { userId: user._id.toString(), tokenVersion: user.tokenVersion },
    JWT_SECRET,
    { expiresIn: JWT_MAX_AGE }
  );
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: JWT_MAX_AGE * 1000,
    path: '/',
  });
}

function safeUser(user) {
  return {
    id:          user._id || user.id,
    email:       user.email,
    username:    user.username,
    displayName: user.displayName,
    avatarUrl:   user.avatarUrl || null,
  };
}

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ success: false, message: 'Not authenticated' });
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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

// ── POST /api/auth/check-username ─────────────────────────────────────────────

router.post('/check-username', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'username is required' });

  if (!USERNAME_RE.test(username)) {
    return res.json({ success: true, available: false, reason: 'invalid' });
  }

  try {
    const existing = await User.findOne({ username: username.toLowerCase() });
    res.json({ success: true, available: !existing });
  } catch (err) {
    console.error('Check username error:', err);
    res.status(500).json({ success: false, message: 'Check failed' });
  }
});

// ── POST /api/auth/signup ────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { email, username, displayName, password } = req.body;

  if (!email || !username || !displayName || !password) {
    return res.status(400).json({ success: false, message: 'email, username, displayName, and password are required' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ success: false, message: 'Username must be 3–20 characters: letters, numbers, underscore only' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ username: username.toLowerCase() }),
    ]);
    if (existingEmail)    return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    if (existingUsername) return res.status(409).json({ success: false, message: 'Username is already taken' });

    const passwordHash = await bcrypt.hash(password, 12);
    const otp          = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt    = new Date(Date.now() + OTP_EXPIRY);

    await PendingVerification.findOneAndUpdate(
      { email: email.toLowerCase() },
      { email: email.toLowerCase(), username: username.toLowerCase(), displayName: displayName.trim(), passwordHash, otp, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[signup] OTP generated for ${email}: ${otp}`);
    console.log(`[signup] Sending email via Resend from="${process.env.FROM_EMAIL || 'onboarding@resend.dev'}" to="${email}"`);

    // Resend SDK v2 returns { data, error } — it does NOT throw on failure
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Your Talent Code Hub verification code!',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px;border:1px solid #e0e0e0;border-radius:10px">
          <h2 style="color:#1976d2;margin:0 0 8px">Verify your email</h2>
          <p style="color:#555;margin:0 0 28px">Enter the code below to complete your <strong>Talent Code Hub</strong> registration. It expires in 5 minutes.</p>
          <div style="background:#f0f4ff;border-radius:8px;padding:24px;text-align:center;margin-bottom:28px">
            <span style="font-size:40px;font-weight:700;letter-spacing:14px;color:#1976d2">${otp}</span>
          </div>
          <p style="color:#999;font-size:12px;margin:0">If you didn't request this, you can safely ignore this email.</p>
        </div>`,
    });

    if (emailError) {
      console.error('[signup] Resend error:', JSON.stringify(emailError, null, 2));
      return res.status(500).json({
        success: false,
        message: `Email delivery failed: ${emailError.message || JSON.stringify(emailError)}`,
      });
    }

    console.log('[signup] Resend success, email id:', emailData?.id);
    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Failed to send verification email' });
  }
});

// ── POST /api/auth/verify-otp ────────────────────────────────────────────────

router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'email and otp are required' });
  }

  try {
    const pending = await PendingVerification.findOne({ email: email.toLowerCase() });

    if (!pending) {
      return res.status(400).json({ success: false, message: 'No pending verification found. Please sign up again.' });
    }
    if (pending.expiresAt < new Date()) {
      await PendingVerification.deleteOne({ email: email.toLowerCase() });
      return res.status(400).json({ success: false, message: 'Code expired. Please sign up again.' });
    }
    // TODO: restore OTP check once Resend domain is verified
    if (pending.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid verification code' });
    }

    const user = await User.create({
      email:        pending.email,
      username:     pending.username,
      displayName:  pending.displayName,
      passwordHash: pending.passwordHash,
    });

    await PendingVerification.deleteOne({ email: email.toLowerCase() });

    issueJwt(res, user);
    res.status(201).json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// ── POST /api/auth/signin ────────────────────────────────────────────────────

router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'email and password are required' });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    issueJwt(res, user);
    res.json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('Signin error:', err);
    res.status(500).json({ success: false, message: 'Sign in failed' });
  }
});

// ── POST /api/auth/signout ───────────────────────────────────────────────────

router.post('/signout', async (req, res) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      await User.findByIdAndUpdate(payload.userId, { $inc: { tokenVersion: 1 } });
    } catch {
      // Token already invalid — still clear the cookie
    }
  }
  res.clearCookie('token', { path: '/' });
  res.json({ success: true, message: 'Signed out successfully' });
});

// ── POST /api/auth/me ────────────────────────────────────────────────────────

router.post('/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.json({ success: true, data: null });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user    = await User.findById(payload.userId);

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      res.clearCookie('token', { path: '/' });
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: safeUser(user) });
  } catch {
    res.clearCookie('token', { path: '/' });
    res.json({ success: true, data: null });
  }
});

// ── POST /api/auth/change-password ───────────────────────────────────────────

router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.tokenVersion += 1;
    await user.save();

    issueJwt(res, user);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Failed to change password' });
  }
});

// ── POST /api/auth/change-display-name ──────────────────────────────────────

router.post('/change-display-name', async (req, res) => {
  const { displayName } = req.body;
  const trimmed = (displayName || '').trim();
  if (!trimmed) return res.status(400).json({ success: false, message: 'displayName is required' });
  if (trimmed.length < 1 || trimmed.length > 50) {
    return res.status(400).json({ success: false, message: 'Display name must be 1–50 characters' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    user.displayName = trimmed;
    await user.save();

    res.json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('Change display name error:', err);
    res.status(500).json({ success: false, message: 'Failed to change display name' });
  }
});

// ── POST /api/auth/change-username ───────────────────────────────────────────

router.post('/change-username', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'username is required' });
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ success: false, message: 'Username must be 3–20 characters: letters, numbers, underscore only' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (user.username === username.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'This is already your username' });
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) return res.status(409).json({ success: false, message: 'Username is already taken' });

    user.username = username.toLowerCase();
    await user.save();

    res.json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('Change username error:', err);
    res.status(500).json({ success: false, message: 'Failed to change username' });
  }
});

// ── POST /api/auth/delete-account ────────────────────────────────────────────

router.post('/delete-account', async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'password is required to confirm deletion' });
  }

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ success: false, message: 'Incorrect password' });
    }

    await User.findByIdAndDelete(user._id);
    res.clearCookie('token', { path: '/' });
    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete account' });
  }
});

// ── POST /api/auth/upload-avatar ─────────────────────────────────────────────

router.post('/upload-avatar', (req, res) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });

    try {
      const user = await requireAuth(req, res);
      if (!user) return;

      const { mimetype, buffer, originalname } = req.file;
      const ext      = originalname.split('.').pop().toLowerCase();
      const filePath = `avatars/${user._id.toString()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, buffer, { contentType: mimetype, upsert: true });

      if (uploadError) {
        return res.status(500).json({ success: false, message: uploadError.message });
      }

      const { data } = supabase.storage.from('profile-pictures').getPublicUrl(filePath);
      // Append cache-bust so browsers reload the new image after re-upload
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      user.avatarUrl = avatarUrl;
      await user.save();

      res.json({ success: true, data: safeUser(user) });
    } catch (err) {
      console.error('Upload avatar error:', err);
      res.status(500).json({ success: false, message: 'Failed to upload avatar' });
    }
  });
});

// ── POST /api/auth/delete-avatar ─────────────────────────────────────────────

router.post('/delete-avatar', async (req, res) => {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (!user.avatarUrl) {
      return res.status(400).json({ success: false, message: 'No avatar to delete' });
    }

    // Extract storage path from the public URL
    // Format: https://<project>.supabase.co/storage/v1/object/public/profile-pictures/avatars/{userId}.{ext}
    const url   = new URL(user.avatarUrl);
    const parts = url.pathname.split('/profile-pictures/');
    if (parts.length === 2) {
      const storagePath = parts[1].split('?')[0];
      await supabase.storage.from('profile-pictures').remove([storagePath]);
    }

    user.avatarUrl = null;
    await user.save();

    res.json({ success: true, data: safeUser(user) });
  } catch (err) {
    console.error('Delete avatar error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete avatar' });
  }
});

module.exports = router;
