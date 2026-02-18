const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { Resend } = require('resend');
const connectDB = require('../db');
const User = require('../models/User');
const PendingVerification = require('../models/PendingVerification');

const router = express.Router();
const resend = new Resend(process.env.RESEND_API_KEY);

const JWT_SECRET  = process.env.JWT_SECRET;
const JWT_MAX_AGE = 7 * 24 * 60 * 60;        // 7 days in seconds
const OTP_EXPIRY  = 5 * 60 * 1000;           // 5 minutes in ms

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
  return { id: user._id || user.id, email: user.email, displayName: user.displayName };
}

// ── POST /api/auth/signup ────────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { email, displayName, password } = req.body;

  if (!email || !displayName || !password) {
    return res.status(400).json({ success: false, message: 'email, displayName, and password are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const otp          = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    const expiresAt    = new Date(Date.now() + OTP_EXPIRY);

    // Upsert so the user can request a new OTP without re-signing up
    await PendingVerification.findOneAndUpdate(
      { email: email.toLowerCase() },
      { email: email.toLowerCase(), displayName: displayName.trim(), passwordHash, otp, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[signup] OTP generated for ${email}: ${otp}`);
    console.log(`[signup] Sending email via Resend from="${process.env.FROM_EMAIL || 'onboarding@resend.dev'}" to="${email}"`);

    // Resend SDK v2 returns { data, error } — it does NOT throw on failure
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.FROM_EMAIL || 'onboarding@resend.dev',
      to: email,
      subject: 'Your Talent Code Hub verification code',
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
      // TODO: restore hard failure once Resend domain is verified
      return res.status(500).json({
        success: false,
        message: `Email delivery failed: ${emailError.message || JSON.stringify(emailError)}`,
      });
      console.error('[signup] Resend error (continuing anyway for testing):', JSON.stringify(emailError, null, 2));
    } else {
      console.log('[signup] Resend success, email id:', emailData?.id);
    }

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
      // Invalidate all existing JWTs for this user instantly
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

module.exports = router;
