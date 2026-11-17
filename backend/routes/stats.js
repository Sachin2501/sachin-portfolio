import { Router } from 'express';
import { db } from '../db/database.js';
import { getAuthenticatedAdmin, extractClientDeletedSet } from '../middleware/auth.js';

export const statsRouter = Router();

// Health check & Node.js environment status
statsRouter.get('/health', async (_req, res) => {
  const dbHealth = await db.getHealth();
  res.json({
    status: 'healthy',
    runtime: 'Node.js ' + process.version,
    language: 'JavaScript (ES Modules)',
    framework: 'Express.js',
    environment: process.env.NODE_ENV || 'development',
    serverUptimeSeconds: Math.floor(process.uptime()),
    rateLimiting: {
      enabled: true,
      engine: 'express-rate-limit',
      globalLimit: '500 requests / 15 min',
      contactLimit: '10 messages / hour',
      authLimit: '25 attempts / 15 min',
    },
    database: dbHealth,
    timestamp: new Date().toISOString(),
  });
});

// Comprehensive stats & metrics for Admin Control Panel
statsRouter.get('/stats', async (req, res) => {
  try {
    const adminUser = getAuthenticatedAdmin(req);
    const clientDeletedSet = extractClientDeletedSet(req);
    const msgDeletedSet = db.messages.getDeletedSet();

    const [
      projectsCount,
      certsCount,
      educationCount,
      experienceCount,
      skillsCount,
      rawMessages,
    ] = await Promise.all([
      db.projects.countDocuments(),
      db.certifications.countDocuments(),
      db.education.countDocuments(),
      db.experience.countDocuments(),
      db.skills.countDocuments(),
      adminUser ? db.messages.find({}) : Promise.resolve([]),
    ]);

    const activeMessages = adminUser && Array.isArray(rawMessages)
      ? rawMessages.filter((m) => {
          if (!m) return false;
          if (db.messages.isDocDeleted(m, msgDeletedSet)) return false;
          const mId = String(m.id ?? m._id ?? '');
          const mMongoId = String(m._id ?? m.id ?? '');
          if (clientDeletedSet.has(mId) || clientDeletedSet.has(mMongoId)) return false;
          return true;
        })
      : [];

    const messagesCount = activeMessages.length;
    const unreadMessagesCount = activeMessages.filter((m) => m.status === 'unread').length;

    const statsDoc = await db.analytics.findOne({ id: 'stats' });
    const pageViews = statsDoc?.pageViews || 1540;

    res.json({
      success: true,
      runtime: 'Node.js ' + process.version,
      databaseType: 'MongoDB Document DB',
      serverUptimeSeconds: Math.floor(process.uptime()),
      pageViews,
      inquiriesCount: messagesCount,
      unreadInquiries: unreadMessagesCount,
      counts: {
        projects: projectsCount,
        certifications: certsCount,
        education: educationCount,
        experience: experienceCount,
        skills: skillsCount,
        messages: messagesCount,
      },
      lastSync: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Pageview tracking
statsRouter.post('/analytics/track', async (req, res) => {
  const { event = 'pageview' } = req.body || {};
  try {
    const statsDoc = await db.analytics.findOne({ id: 'stats' });
    let newViews = 1541;
    if (statsDoc) {
      newViews = (statsDoc.pageViews || 1540) + 1;
      await db.analytics.updateOne({ id: 'stats' }, { pageViews: newViews });
    } else {
      await db.analytics.create({ id: 'stats', pageViews: newViews });
    }
    res.json({ success: true, pageViews: newViews, event });
  } catch {
    res.json({ success: true, pageViews: 1542, fallback: true });
  }
});
