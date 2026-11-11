import { Router } from 'express';
import { AuditLogModel } from '../models/index.js';
import { authenticateAdmin } from '../middleware/auth.js';

export const auditLogsRouter = Router();

/**
 * GET /api/audit-logs
 * Retrieves audit log entries with optional filtering by collection, action, and search query.
 * Restricted to authenticated admins.
 */
auditLogsRouter.get('/', async (req, res) => {
  try {
    const { collection, action, user, search, limit = '100' } = req.query || {};

    let logs = await AuditLogModel.find();

    // Sort newest first
    logs = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 1. Filter by collection (e.g. projects, experience, certifications, education, skills, profile)
    if (collection && collection !== 'all') {
      const targetCol = String(collection).trim().toLowerCase();
      logs = logs.filter((log) => String(log.collectionName).toLowerCase() === targetCol);
    }

    // 2. Filter by action (CREATE, UPDATE, DELETE)
    if (action && action !== 'all') {
      const targetAct = String(action).trim().toUpperCase();
      logs = logs.filter((log) => String(log.action).toUpperCase() === targetAct);
    }

    // 3. Filter by admin user
    if (user && user !== 'all') {
      const targetUser = String(user).trim().toLowerCase();
      logs = logs.filter(
        (log) =>
          (log.changedBy?.username && log.changedBy.username.toLowerCase() === targetUser) ||
          (log.changedBy?.email && log.changedBy.email.toLowerCase() === targetUser)
      );
    }

    // 4. Search keyword in targetTitle, targetId, username, or details
    if (search && String(search).trim()) {
      const query = String(search).trim().toLowerCase();
      logs = logs.filter((log) => {
        const titleMatch = log.targetTitle && log.targetTitle.toLowerCase().includes(query);
        const idMatch = log.targetId && log.targetId.toLowerCase().includes(query);
        const userMatch = log.changedBy?.username && log.changedBy.username.toLowerCase().includes(query);
        const emailMatch = log.changedBy?.email && log.changedBy.email.toLowerCase().includes(query);
        return titleMatch || idMatch || userMatch || emailMatch;
      });
    }

    const total = logs.length;
    const maxLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
    const paginated = logs.slice(0, maxLimit);

    return res.json({
      success: true,
      count: paginated.length,
      total,
      data: paginated,
    });
  } catch (err) {
    console.error('[GET /api/audit-logs Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/audit-logs/stats
 * Provides statistical summary of audit logs (actions breakdown, collection breakdown, active admins)
 */
auditLogsRouter.get('/stats', async (_req, res) => {
  try {
    const logs = await AuditLogModel.find();

    const stats = {
      total: logs.length,
      byCollection: {
        projects: 0,
        experience: 0,
        certifications: 0,
        education: 0,
        skills: 0,
        profile: 0,
        messages: 0,
        other: 0,
      },
      byAction: {
        CREATE: 0,
        UPDATE: 0,
        DELETE: 0,
      },
      recent24h: 0,
      admins: {},
      lastActivity: null,
    };

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    for (const log of logs) {
      // Collection count
      const col = (log.collectionName || 'other').toLowerCase();
      if (stats.byCollection[col] !== undefined) {
        stats.byCollection[col]++;
      } else {
        stats.byCollection.other++;
      }

      // Action count
      const act = (log.action || '').toUpperCase();
      if (stats.byAction[act] !== undefined) {
        stats.byAction[act]++;
      }

      // 24h count
      const logTime = new Date(log.timestamp).getTime();
      if (logTime >= oneDayAgo) {
        stats.recent24h++;
      }

      // Latest activity
      if (!stats.lastActivity || logTime > new Date(stats.lastActivity).getTime()) {
        stats.lastActivity = log.timestamp;
      }

      // Admin breakdown
      const adminName = log.changedBy?.username || 'admin';
      stats.admins[adminName] = (stats.admins[adminName] || 0) + 1;
    }

    return res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    console.error('[GET /api/audit-logs/stats Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/audit-logs/:id
 * Removes a specific audit log entry permanently from local JSON & MongoDB Atlas (restricted to authenticated admin)
 */
auditLogsRouter.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    if (!rawId) {
      return res.status(400).json({ success: false, error: 'Audit log ID is required.' });
    }
    const deleted = await AuditLogModel.findByIdAndDelete(rawId);
    if (deleted) {
      return res.json({
        success: true,
        id: rawId,
        message: 'Audit log entry permanently removed from database.',
      });
    }
    return res.status(404).json({ success: false, error: 'Audit log entry not found.' });
  } catch (err) {
    console.error('[DELETE /api/audit-logs/:id Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/audit-logs/clear
 * Clears audit logs permanently from local JSON & MongoDB Atlas in a single batch operation
 */
auditLogsRouter.post('/clear', authenticateAdmin, async (req, res) => {
  try {
    const { collection } = req.body || {};
    const targetCol =
      collection && String(collection).trim() && String(collection).trim().toLowerCase() !== 'all'
        ? String(collection).trim().toLowerCase()
        : null;

    const filter = targetCol ? { collectionName: targetCol } : {};
    const removedCount = await AuditLogModel.deleteMany(filter);

    return res.json({
      success: true,
      message: `Cleared ${removedCount} audit log entries permanently from database.`,
      removedCount,
    });
  } catch (err) {
    console.error('[POST /api/audit-logs/clear Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
