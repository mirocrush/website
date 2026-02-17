const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const DB_PATH = path.join(__dirname, '../data/blogs.json');

function readDB() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// POST /api/blogs/list — get all blogs
router.post('/list', (_req, res) => {
  try {
    const blogs = readDB();
    const sorted = [...blogs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to read blogs' });
  }
});

// POST /api/blogs/get — get single blog by id
router.post('/get', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const blogs = readDB();
    const blog = blogs.find((b) => b.id === id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    res.json({ success: true, data: blog });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to read blog' });
  }
});

// POST /api/blogs/create — create a new blog
router.post('/create', (req, res) => {
  const { title, content, author, tags } = req.body;

  if (!title || !content || !author) {
    return res
      .status(400)
      .json({ success: false, message: 'title, content, and author are required' });
  }

  try {
    const blogs = readDB();
    const now = new Date().toISOString();
    const newBlog = {
      id: uuidv4(),
      title: title.trim(),
      content: content.trim(),
      author: author.trim(),
      tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
      createdAt: now,
      updatedAt: now,
    };

    blogs.push(newBlog);
    writeDB(blogs);
    res.status(201).json({ success: true, data: newBlog });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create blog' });
  }
});

// POST /api/blogs/update — update an existing blog
router.post('/update', (req, res) => {
  const { id, title, content, author, tags } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const blogs = readDB();
    const index = blogs.findIndex((b) => b.id === id);
    if (index === -1)
      return res.status(404).json({ success: false, message: 'Blog not found' });

    blogs[index] = {
      ...blogs[index],
      title: title !== undefined ? title.trim() : blogs[index].title,
      content: content !== undefined ? content.trim() : blogs[index].content,
      author: author !== undefined ? author.trim() : blogs[index].author,
      tags: Array.isArray(tags)
        ? tags.map((t) => t.trim()).filter(Boolean)
        : blogs[index].tags,
      updatedAt: new Date().toISOString(),
    };

    writeDB(blogs);
    res.json({ success: true, data: blogs[index] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update blog' });
  }
});

// POST /api/blogs/delete — delete a blog
router.post('/delete', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ success: false, message: 'id is required' });

  try {
    const blogs = readDB();
    const index = blogs.findIndex((b) => b.id === id);
    if (index === -1)
      return res.status(404).json({ success: false, message: 'Blog not found' });

    blogs.splice(index, 1);
    writeDB(blogs);
    res.json({ success: true, message: 'Blog deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete blog' });
  }
});

module.exports = router;
