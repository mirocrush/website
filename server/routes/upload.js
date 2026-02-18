const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const connectDB = require('../db');
const upload = require('../middleware/upload');

const router = express.Router();

// Initialise Supabase with the service_role key (server-side only)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Ensure DB connected + validate admin token on every request
router.use(async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.UPLOAD_ADMIN_TOKEN}`) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  await connectDB();
  next();
});

// POST /api/upload — upload a single file to Supabase Storage
router.post('/', (req, res) => {
  // Run multer first, then handle its errors as JSON
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const { mimetype, buffer, originalname, size } = req.file;
    const isImage = mimetype.startsWith('image/');
    const bucket  = isImage ? 'blog-images' : 'blog-pdfs';
    const folder  = isImage ? 'images' : 'pdfs';
    const ext     = originalname.split('.').pop().toLowerCase();
    const month   = new Date().toISOString().slice(0, 7); // e.g. "2026-02"
    const filePath = `${folder}/${month}/${uuidv4()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, buffer, { contentType: mimetype, upsert: false });

    if (uploadError) {
      return res.status(500).json({ success: false, message: uploadError.message });
    }

    // Public URL for images; path-only for private PDFs
    let url = null;
    if (isImage) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      url = data.publicUrl;
    }

    res.json({
      success: true,
      data: { bucket, path: filePath, url, mimeType: mimetype, size },
    });
  });
});

module.exports = router;
