const express   = require('express');
const connectDB = require('../db');
const Theme     = require('../models/Theme');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

// Seed the first theme if the collection is empty
async function seedThemes() {
  const count = await Theme.countDocuments();
  if (count === 0) {
    await Theme.create({
      themeId:     'minimal',
      name:        'Minimal',
      description: 'Clean and minimal. White background, sharp typography, professional look.',
      isActive:    true,
      isPremium:   false,
    });
  }
}

// GET /api/themes/list  — public, no auth required
router.get('/list', async (_req, res) => {
  try {
    await seedThemes();
    const themes = await Theme.find({ isActive: true }).sort({ isPremium: 1, name: 1 });
    res.json({ success: true, data: themes });
  } catch (err) {
    console.error('[themes/list]', err);
    res.status(500).json({ success: false, message: 'Failed to list themes' });
  }
});

module.exports = router;
