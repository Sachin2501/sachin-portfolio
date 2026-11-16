import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const certificatesDir = path.resolve(__dirname, '../public/certificates');

export const app = express();

// Trust reverse proxy if running behind Render, Railway, Vercel, or Nginx
app.set('trust proxy', 1);

// Middlewares - Support large uploads for images, PDFs, and certificates
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Support direct file downloads (?download=1) and alias fallback for certificates
app.use('/certificates', (req, res, next) => {
  const decodedPath = decodeURIComponent(req.path || '').replace(/^\/+/, '');
  if (decodedPath === 'cert_1794402839759_c8srr.pdf') {
    const primaryPath = path.join(certificatesDir, 'cert_1794402839759_c8srr.pdf');
    const fallbackPath = path.join(certificatesDir, 'tcs-ai-hackathon.pdf');
    if (!fs.existsSync(primaryPath) && fs.existsSync(fallbackPath)) {
      req.url = '/tcs-ai-hackathon.pdf';
    }
  }
  if (req.query && (req.query.download === '1' || req.query.download === 'true')) {
    const customName = req.query.filename
      ? String(req.query.filename).replace(/[^a-zA-Z0-9._-]/g, '_')
      : path.basename(decodedPath || 'certificate.pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${customName}"`);
  }
  next();
});

// Fast static serving for certificate images and PDFs with browser caching
app.use(
  '/certificates',
  express.static(certificatesDir, {
    maxAge: '1d',
    etag: true,
    lastModified: true,
  })
);

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
      portfolio: 'GET /api/portfolio',
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

// JSON 404 handler for unmatched /api/* routes (Express 5 compatible)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});


