const express = require('express');
const connectDB = require('../db');
const Blog = require('../models/Blog');

const router = express.Router();

// Ensure DB is connected on every request (safe for Vercel serverless)
router.use(async (_req, _res, next) => {
  await connectDB();
  next();
});

// POST /api/blogs/list — get all blogs
router.post('/list', async (_req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json({ success: true, data: blogs });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to read blogs' });
  }
});

// POST /api/blogs/get — get single blog by id
router.post('/get', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to read blog' });
  }
});

// POST /api/blogs/create — create a new blog
router.post('/create', async (req, res) => {
  const { title, content, author, tags } = req.body;

  if (!title || !content || !author) {
    return res
      .status(400)
      .json({ success: false, message: 'title, content, and author are required' });
  }

  try {
    const blog = await Blog.create({
      title: title.trim(),
      content: content.trim(),
      author: author.trim(),
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
    });
    res.status(201).json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create blog' });
  }
});

// POST /api/blogs/update — update an existing blog
router.post('/update', async (req, res) => {
  const { id, title, content, author, tags } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const update = {};
    if (title !== undefined)       update.title   = title.trim();
    if (content !== undefined)     update.content = content.trim();
    if (author !== undefined)      update.author  = author.trim();
    if (Array.isArray(tags))       update.tags    = tags.map((t) => t.trim()).filter(Boolean);

    const blog = await Blog.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update blog' });
  }
});

// POST /api/blogs/delete — delete a blog
router.post('/delete', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const blog = await Blog.findByIdAndDelete(id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete blog' });
  }
});

module.exports = router;
