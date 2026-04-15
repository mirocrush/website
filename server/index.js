require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');
const blogRoutes      = require('./routes/blogs');
const uploadRoutes    = require('./routes/upload');
const fileRoutes      = require('./routes/files');
const authRoutes      = require('./routes/auth');
const portfolioRoutes  = require('./routes/portfolios');
const friendRoutes     = require('./routes/friends');
const userRoutes       = require('./routes/users');
const serverRoutes     = require('./routes/servers');
const channelRoutes    = require('./routes/channels');
const dmRoutes         = require('./routes/dms');
const convRoutes       = require('./routes/conversations');
const messageRoutes    = require('./routes/messages');
const pusherAuthRoutes = require('./routes/pusherAuth');
const themeRoutes      = require('./routes/themes');
const resumeRoutes     = require('./routes/resumeParser');
const githubIssueRoutes  = require('./routes/githubIssues');
const smartSearchRoutes  = require('./routes/smartSearch');
const promptRoutes       = require('./routes/prompts');
const v1Routes               = require('./routes/v1');
const notificationRoutes     = require('./routes/notifications');
const searchSessionRoutes    = require('./routes/searchSession');
const profileRoutes          = require('./routes/profiles');
const reveloRoutes           = require('./routes/revelo');

const app = express();

// Allow credentials + specific origins (required for httpOnly cookie auth)
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3100',
  'https://www.deeptalenthub.com',
  'https://deeptalenthub.com',
  'https://www.talentcodehub.com',
  'https://talentcodehub.com',
  'https://website-git-main-mirocrushs-projects.vercel.app',
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
app.use(express.json({ limit: '10mb' }));
// Pusher sends auth requests as application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// API routes
app.use('/api/auth',       authRoutes);
app.use('/api/blogs',      blogRoutes);
app.use('/api/upload',     uploadRoutes);
app.use('/api/files',      fileRoutes);
app.use('/api/portfolios', portfolioRoutes);
app.use('/api/friends',       friendRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/servers',       serverRoutes);
app.use('/api/channels',      channelRoutes);
app.use('/api/dms',           dmRoutes);
app.use('/api/conversations',  convRoutes);
app.use('/api/messages',       messageRoutes);
app.use('/api/pusher',         pusherAuthRoutes);
app.use('/api/themes',         themeRoutes);
app.use('/api/resume',         resumeRoutes);
app.use('/api/github-issues',  githubIssueRoutes);
app.use('/api/smart-search',   smartSearchRoutes);
app.use('/api/prompts',        promptRoutes);
app.use('/v1',                 v1Routes);
app.use('/api/notifications',  notificationRoutes);
app.use('/api/search-session', searchSessionRoutes);
app.use('/api/profiles',       profileRoutes);
app.use('/api/revelo',         reveloRoutes);

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
