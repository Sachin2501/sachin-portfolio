import express from 'express';
import cors from 'cors';
import { contactRouter } from './routes/contact.js';
import { portfolioRouter } from './routes/portfolio.js';
import { statsRouter } from './routes/stats.js';
import { authRouter } from './routes/auth.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { githubRouter } from './routes/github.js';
import {
  globalApiLimiter,
  contactRateLimiter,
  authRateLimiter,
  analyticsRateLimiter,
} from './middleware/rateLimiter.js';

export const app = express();

// Trust reverse proxy if running behind Render, Railway, Vercel, or Nginx
app.set('trust proxy', 1);

// Middlewares - Support large uploads for images, PDFs, and certificates
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// 1. Apply Global Rate Limiter to all /api routes to prevent abuse & protect MongoDB
app.use('/api', globalApiLimiter);

// 2. Specific Route Rate Limiters for heightened protection
app.use('/api/contact', contactRateLimiter, contactRouter);
app.use('/api/auth', authRateLimiter, authRouter);
app.use('/api/analytics/track', analyticsRateLimiter);
app.use('/api/mongo/connect', authRateLimiter);

// 3. Mount portfolio, stats, github, and audit-logs routers
app.use('/api/github', githubRouter);
app.use('/api', portfolioRouter);
app.use('/api', statsRouter);
app.use('/api/audit-logs', auditLogsRouter);

// Base backend status
app.get('/api', (_req, res) => {
  res.json({
    message: 'Sachin Kumar Portfolio Node.js & MongoDB API Engine',
    language: 'JavaScript (Node.js)',
    database: 'MongoDB NoSQL',
    rateLimiting: {
      status: 'active',
      engine: 'express-rate-limit',
      policies: {
        global: '500 requests per 15 minutes',
        contact: '10 messages per 1 hour (anti-spam)',
        auth: '25 attempts per 15 minutes (brute-force guard)',
        analytics: '60 pings per minute',
      },
    },
    version: '2.1.0',
    documentation: {
      health: 'GET /api/health',
      stats: 'GET /api/stats',
      projects: 'GET, POST, PUT, DELETE /api/projects',
      certifications: 'GET, POST, PUT, DELETE /api/certifications',
      education: 'GET, POST, PUT, DELETE /api/education',
      experience: 'GET, POST, PUT, DELETE /api/experience',
      skills: 'GET, POST, PUT, DELETE /api/skills',
      profile: 'GET, PUT /api/profile',
      contact: 'POST /api/contact, GET /api/contact/messages',
      auth: 'POST /api/auth/verify',
    },
  });
});
