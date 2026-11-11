import { AuditLogModel } from '../models/index.js';

/**
 * Sanitizes a document snapshot to avoid storing circular refs, secrets, or multi-MB base64 blobs in audit logs
 */
function sanitizeSnapshot(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const clone = { ...doc };
  delete clone.passwordHash;
  delete clone.passwordSalt;

  for (const [key, val] of Object.entries(clone)) {
    if (typeof val === 'string' && (val.startsWith('data:') || val.length > 1000)) {
      clone[key] = `[Uploaded Media/PDF (${Math.round(val.length / 1024)} KB)]`;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      const subClone = { ...val };
      for (const [subKey, subVal] of Object.entries(subClone)) {
        if (typeof subVal === 'string' && (subVal.startsWith('data:') || subVal.length > 1000)) {
          subClone[subKey] = `[Uploaded Media/PDF (${Math.round(subVal.length / 1024)} KB)]`;
        }
      }
      clone[key] = subClone;
    }
  }
  return clone;
}

/**
 * Records an audit log event for portfolio data mutations.
 */
export async function recordAuditLog({
  req,
  action,
  collectionName,
  targetId,
  targetTitle,
  before = null,
  after = null,
  modifiedFields = [],
  metadata = {},
}) {
  try {
    const user = req?.user || {};
    const changedBy = {
      username: user.username || 'admin',
      email: user.email || 'sachinkumar.gheura@gmail.com',
      name: user.name || 'Sachin Kumar (Admin)',
      role: user.role || 'admin',
      userId: user.id || user._id || 'admin_default',
    };

    const ipAddress =
      req?.ip ||
      req?.headers?.['x-forwarded-for'] ||
      req?.socket?.remoteAddress ||
      '127.0.0.1';

    const userAgent = req?.headers?.['user-agent'] || 'Unknown Client';

    // Auto-detect modified fields if not explicitly passed
    let finalModifiedFields = modifiedFields;
    if (action === 'UPDATE' && (!finalModifiedFields || finalModifiedFields.length === 0) && before && after) {
      finalModifiedFields = Object.keys(after).filter(
        (key) => key !== 'updatedAt' && JSON.stringify(before[key]) !== JSON.stringify(after[key])
      );
    }

    const logEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: String(action).toUpperCase(),
      collectionName,
      targetId: String(targetId || 'unknown'),
      targetTitle: String(targetTitle || 'Untitled Item').slice(0, 200),
      changedBy,
      diff: {
        before: sanitizeSnapshot(before),
        after: sanitizeSnapshot(after),
        modifiedFields: Array.isArray(finalModifiedFields) ? finalModifiedFields : [],
      },
      metadata: {
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : '127.0.0.1',
        userAgent: String(userAgent).slice(0, 255),
        method: req?.method || 'UNKNOWN',
        endpoint: req?.originalUrl || req?.url || '',
        ...metadata,
      },
    };

    const saved = await AuditLogModel.create(logEntry);

    console.log(
      `[AuditLog] [${logEntry.action}] on "${collectionName}" ("${logEntry.targetTitle}") by @${changedBy.username} at ${logEntry.timestamp}`
    );

    return saved;
  } catch (err) {
    console.error('[AuditLogger Error]: Failed to write audit log:', err);
    return null;
  }
}
