const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const connectDB = require('../db');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// POST /api/files/pdf — generate a short-lived signed URL for a private PDF
router.post('/pdf', async (req, res) => {
  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ success: false, message: 'path is required' });
  }

  const { data, error } = await supabase.storage
    .from('blog-pdfs')
    .createSignedUrl(path, 60); // expires in 60 seconds

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  res.json({ success: true, data: { signedUrl: data.signedUrl } });
});

// POST /api/files/delete — permanently delete a file from Supabase Storage
// Requires admin token (same as /api/upload)
router.post('/delete', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.UPLOAD_ADMIN_TOKEN}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { bucket, path } = req.body;
  if (!bucket || !path) {
    return res.status(400).json({ success: false, message: 'bucket and path are required' });
  }

  const VALID_BUCKETS = new Set(['blog-images', 'blog-pdfs']);
  if (!VALID_BUCKETS.has(bucket)) {
    return res.status(400).json({ success: false, message: 'Invalid bucket name' });
  }

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

  res.json({ success: true, message: 'File deleted from storage' });
});

module.exports = router;
