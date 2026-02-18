require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');
const blogRoutes   = require('./routes/blogs');
const uploadRoutes = require('./routes/upload');
const fileRoutes   = require('./routes/files');
const authRoutes   = require('./routes/auth');

const app = express();

// Allow credentials + specific origins (required for httpOnly cookie auth)
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3100',
  // 'https://www.deeptalenthub.com',
  // 'https://deeptalenthub.com',
  // 'https://website-git-main-mirocrushs-projects.vercel.app',
  // CLIENT_URL: your custom domain (e.g. https://www.talentcodehub.com)
  // ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
  // VERCEL_URL: auto-injected by Vercel (e.g. your-app.vercel.app) — no https prefix
  ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
]);

app.use(cors({
  origin: (origin, cb) => {
    // Same-origin requests on Vercel have no Origin header
    if (!origin || allowedOrigins.has(origin)) cb(null, true);
    else cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

// API routes
app.use('/api/auth',   authRoutes);
app.use('/api/blogs',  blogRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/files',  fileRoutes);

// Serve the React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Export for Vercel serverless
module.exports = app;

// Start server when run directly (local dev)
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
