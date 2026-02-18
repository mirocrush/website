require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const blogRoutes   = require('./routes/blogs');
const uploadRoutes = require('./routes/upload');
const fileRoutes   = require('./routes/files');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/blogs',  blogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files',  fileRoutes);

// Serve the React build (dist/ is bundled via vercel.json includeFiles in production)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Export the app for Vercel (serverless function)
module.exports = app;

// Also start the server when run directly (local dev / local production)
if (require.main === module) {
  const connectDB = require('./db');
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('MongoDB connection failed:', err.message);
      process.exit(1);
    });
}
