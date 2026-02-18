const express   = require('express');
const connectDB = require('../db');
const User      = require('../models/User');

const router = express.Router();

router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// ── POST /api/users/profile ───────────────────────────────────────────────────
// Public — returns basic profile info by username

router.post('/profile', async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ success: false, message: 'username is required' });

  try {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({
      success: true,
      data: {
        id:          user._id.toString(),
        displayName: user.displayName,
        username:    user.username,
        avatarUrl:   user.avatarUrl || null,
        createdAt:   user.createdAt,
      },
    });
  } catch (err) {
    console.error('[users/profile]', err);
    res.status(500).json({ success: false, message: 'Failed to load profile' });
  }
});

module.exports = router;
