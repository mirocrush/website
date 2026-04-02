const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const connectDB = require('../db');
const Blog = require('../models/Blog');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

async function deleteFilesFromSupabase(files) {
  const byBucket = {};
  for (const f of files) {
    if (!byBucket[f.bucket]) byBucket[f.bucket] = [];
    byBucket[f.bucket].push(f.path);
  }
  await Promise.allSettled(
    Object.entries(byBucket).map(([bucket, paths]) =>
      supabase.storage.from(bucket).remove(paths)
    )
  );
}

// POST /api/blogs/list
router.post('/list', async (_req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json({ success: true, data: blogs });
  } catch (err) {
    console.error('[blogs/list]', err);
    res.status(500).json({ success: false, message: 'Failed to read issues' });
  }
});

// POST /api/blogs/get
router.post('/get', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error('[blogs/get]', err);
    res.status(500).json({ success: false, message: 'Failed to read issue' });
  }
});

// POST /api/blogs/create
router.post('/create', async (req, res) => {
  const { title, content, author, userId, username, tags, images, pdfs } = req.body;
  if (!title || !content || !author) {
    return res.status(400).json({ success: false, message: 'title, content, and author are required' });
  }
  try {
    const blog = await Blog.create({
      title:    title.trim(),
      content:  content.trim(),
      author:   author.trim(),
      userId:   userId || null,
      username: username || null,
      tags:     Array.isArray(tags)   ? tags.map((t) => t.trim()).filter(Boolean) : [],
      images:   Array.isArray(images) ? images : [],
      pdfs:     Array.isArray(pdfs)   ? pdfs   : [],
    });
    res.status(201).json({ success: true, data: blog });
  } catch (err) {
    console.error('[blogs/create]', err);
    res.status(500).json({ success: false, message: 'Failed to create issue' });
  }
});

// POST /api/blogs/update
router.post('/update', async (req, res) => {
  const { id, title, content, author, tags, images, pdfs } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const update = {};
    if (title   !== undefined) update.title   = title.trim();
    if (content !== undefined) update.content = content.trim();
    if (author  !== undefined) update.author  = author.trim();
    if (Array.isArray(tags))   update.tags    = tags.map((t) => t.trim()).filter(Boolean);
    if (Array.isArray(images)) update.images  = images;
    if (Array.isArray(pdfs))   update.pdfs    = pdfs;

    const blog = await Blog.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error('[blogs/update]', err);
    res.status(500).json({ success: false, message: 'Failed to update issue' });
  }
});

// POST /api/blogs/delete
router.post('/delete', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });
  try {
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    const allFiles = [...(blog.images || []), ...(blog.pdfs || [])];
    if (allFiles.length > 0) await deleteFilesFromSupabase(allFiles);
    res.json({ success: true, message: 'Issue deleted successfully' });
  } catch (err) {
    console.error('[blogs/delete]', err);
    res.status(500).json({ success: false, message: 'Failed to delete issue' });
  }
});

// POST /api/blogs/comment — add a comment
router.post('/comment', async (req, res) => {
  const { id, userId, username, displayName, content } = req.body;
  if (!id || !userId || !content) {
    return res.status(400).json({ success: false, message: 'id, userId, and content are required' });
  }
  try {
    const blog = await Blog.findByIdAndUpdate(
      id,
      { $push: { comments: { userId, username: username || '', displayName: displayName || '', content: content.trim() } } },
      { new: true }
    );
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error('[blogs/comment]', err);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
});

// POST /api/blogs/like — toggle like
router.post('/like', async (req, res) => {
  const { id, userId } = req.body;
  if (!id || !userId) {
    return res.status(400).json({ success: false, message: 'id and userId are required' });
  }
  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    const alreadyLiked = blog.likes.includes(userId);
    const updated = await Blog.findByIdAndUpdate(
      id,
      alreadyLiked ? { $pull: { likes: userId } } : { $push: { likes: userId } },
      { new: true }
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[blogs/like]', err);
    res.status(500).json({ success: false, message: 'Failed to toggle like' });
  }
});

// POST /api/blogs/close — mark issue as closed (reporter only)
router.post('/close', async (req, res) => {
  const { id, userId } = req.body;
  if (!id || !userId) {
    return res.status(400).json({ success: false, message: 'id and userId are required' });
  }
  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (blog.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the reporter can close this issue' });
    }
    const updated = await Blog.findByIdAndUpdate(id, { status: 'closed' }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[blogs/close]', err);
    res.status(500).json({ success: false, message: 'Failed to close issue' });
  }
});

// POST /api/blogs/solve — mark issue as solved (reporter only)
router.post('/solve', async (req, res) => {
  const { id, userId } = req.body;
  if (!id || !userId) {
    return res.status(400).json({ success: false, message: 'id and userId are required' });
  }
  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    if (blog.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Only the reporter can mark this issue as solved' });
    }
    const updated = await Blog.findByIdAndUpdate(id, { status: 'solved' }, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('[blogs/solve]', err);
    res.status(500).json({ success: false, message: 'Failed to solve issue' });
  }
});

// POST /api/blogs/edit-comment — edit own comment
router.post('/edit-comment', async (req, res) => {
  const { id, commentId, userId, content } = req.body;
  if (!id || !commentId || !userId || !content) {
    return res.status(400).json({ success: false, message: 'id, commentId, userId, and content are required' });
  }
  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    const comment = blog.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    if (comment.userId !== userId) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }
    comment.content = content.trim();
    await blog.save();
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error('[blogs/edit-comment]', err);
    res.status(500).json({ success: false, message: 'Failed to edit comment' });
  }
});

// POST /api/blogs/like-comment — toggle like on a comment
router.post('/like-comment', async (req, res) => {
  const { id, commentId, userId } = req.body;
  if (!id || !commentId || !userId) {
    return res.status(400).json({ success: false, message: 'id, commentId, and userId are required' });
  }
  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Issue not found' });
    const comment = blog.comments.id(commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });
    const idx = comment.likes.indexOf(userId);
    if (idx >= 0) comment.likes.splice(idx, 1);
    else comment.likes.push(userId);
    await blog.save();
    res.json({ success: true, data: blog });
  } catch (err) {
    console.error('[blogs/like-comment]', err);
    res.status(500).json({ success: false, message: 'Failed to toggle comment like' });
  }
});

module.exports = router;
