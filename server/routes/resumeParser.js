const express   = require('express');
const multer    = require('multer');
const jwt       = require('jsonwebtoken');
const connectDB = require('../db');
const User      = require('../models/User');
const { parseResume, extractText } = require('../lib/resumeParser');

const router = express.Router();
router.use(async (_req, _res, next) => { await connectDB(); next(); });

// Accept PDF / DOCX / DOC — store in memory, max 10 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF and DOCX files are supported'));
  },
});

const JWT_SECRET = process.env.JWT_SECRET;

async function requireAuth(req, res) {
  const token = req.cookies?.token;
  if (!token) { res.status(401).json({ success: false, message: 'Not authenticated' }); return null; }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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

// POST /api/resume/parse
// Body: multipart/form-data  { resume: File }
// Returns: { success: true, data: parsedPortfolioFields }
router.post('/parse', (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });

    const user = await requireAuth(req, res);
    if (!user) return;

    if (!req.file) return res.status(400).json({ success: false, message: 'No file provided' });

    try {
      const text = await extractText(req.file.buffer, req.file.mimetype);

      // Warn if very little text was extracted (likely a scanned PDF)
      if ((text || '').trim().length < 100) {
        return res.status(422).json({
          success: false,
          message:
            'Could not extract enough text from this file. ' +
            'If it is a PDF, make sure it is text-based (not a scanned image).',
        });
      }

      const parsed = parseResume(text);
      res.json({ success: true, data: parsed });
    } catch (err) {
      console.error('[resume/parse]', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to parse resume' });
    }
  });
});

module.exports = router;
