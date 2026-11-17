import { Router } from 'express';
import { AuditLogModel } from '../models/index.js';
import { db } from '../db/database.js';
import { authenticateAdmin, extractClientDeletedSet } from '../middleware/auth.js';

export const auditLogsRouter = Router();

function filterActiveAuditLogs(rawLogs = [], req = null) {
  const clientDeletedSet = extractClientDeletedSet(req);
  const auditDeletedSet = db.auditLogs.getDeletedSet();
  const msgDeletedSet = db.messages.getDeletedSet();

  return (Array.isArray(rawLogs) ? rawLogs : []).filter((log) => {
    if (!log) return false;
    if (db.auditLogs.isDocDeleted(log, auditDeletedSet)) return false;
    const logId = String(log.id ?? log._id ?? '');
    const logMongoId = String(log._id ?? log.id ?? '');
    const targetId = String(log.targetId ?? '');
    if (
      clientDeletedSet.has(logId) ||
      clientDeletedSet.has(logMongoId) ||
      (targetId && clientDeletedSet.has(targetId))
    ) {
      return false;
    }
    if (
      String(log.collectionName || '').toLowerCase() === 'messages' &&
      targetId &&
      msgDeletedSet.has(targetId)
    ) {
      return false;
    }
    return true;
  });
}

/**
 * GET /api/audit-logs
 * Retrieves audit log entries with optional filtering by collection, action, and search query.
 * Restricted to authenticated admins.
 */
auditLogsRouter.get('/', authenticateAdmin, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { collection, action, user, search, limit = '100' } = req.query || {};

    const rawLogs = await AuditLogModel.find();
    let logs = filterActiveAuditLogs(rawLogs, req);

    // Sort newest first
    logs = [...logs].sort(
      (a, b) =>
        (new Date(b.timestamp || b.createdAt || 0).getTime() || 0) -
        (new Date(a.timestamp || a.createdAt || 0).getTime() || 0)
    );

    // 1. Filter by collection (e.g. projects, experience, certifications, education, skills, profile)
    if (collection && collection !== 'all') {
      const targetCol = String(collection).trim().toLowerCase();
      logs = logs.filter((log) => String(log.collectionName || '').toLowerCase() === targetCol);
    }

    // 2. Filter by action (CREATE, UPDATE, DELETE)
    if (action && action !== 'all') {
      const targetAct = String(action).trim().toUpperCase();
      logs = logs.filter((log) => String(log.action || '').toUpperCase() === targetAct);
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
        const idMatch = log.targetId && String(log.targetId).toLowerCase().includes(query);
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
auditLogsRouter.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const rawLogs = await AuditLogModel.find();
    const logs = filterActiveAuditLogs(rawLogs, req);

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
      const logTime = new Date(log.timestamp || log.createdAt || 0).getTime() || 0;
      if (logTime >= oneDayAgo) {
        stats.recent24h++;
      }

      // Latest activity
      if (!stats.lastActivity || logTime > new Date(stats.lastActivity).getTime()) {
        stats.lastActivity = log.timestamp || log.createdAt || null;
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
    const existing = await AuditLogModel.findById(rawId);
    const deleted = await AuditLogModel.findByIdAndDelete(rawId);
    if (existing?.id && String(existing.id) !== rawId) {
      await AuditLogModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== rawId) {
      await AuditLogModel.findByIdAndDelete(String(existing._id));
    }
    return res.json({
      success: true,
      id: rawId,
      alreadyDeleted: !deleted && !existing,
      message: 'Audit log entry permanently removed from database.',
    });
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
