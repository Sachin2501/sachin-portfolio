import { Router } from 'express';
import { MessageModel, AuditLogModel } from '../models/index.js';
import { db } from '../db/database.js';
import { recordAuditLog } from '../services/auditLogger.js';
import { authenticateAdmin, extractClientDeletedSet } from '../middleware/auth.js';

export const contactRouter = Router();

// GET all contact messages from MongoDB (restricted to authenticated admin sessions, sorted newest first)
contactRouter.get('/messages', authenticateAdmin, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const clientDeletedSet = extractClientDeletedSet(req);
    const messages = await MessageModel.find({});
    const deletedSet = db.messages.getDeletedSet();

    const filtered = Array.isArray(messages)
      ? messages.filter((m) => {
          if (!m) return false;
          if (db.messages.isDocDeleted(m, deletedSet)) return false;
          const mId = String(m.id ?? m._id ?? '');
          const mMongoId = String(m._id ?? m.id ?? '');
          if (clientDeletedSet.has(mId) || clientDeletedSet.has(mMongoId)) return false;
          return true;
        })
      : [];

    const sorted = [...filtered].sort((a, b) => {
      const tA = new Date(a.timestamp || a.createdAt || 0).getTime() || 0;
      const tB = new Date(b.timestamp || b.createdAt || 0).getTime() || 0;
      return tB - tA;
    });

    res.json({
      success: true,
      count: sorted.length,
      messages: sorted,
      data: sorted,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const FORMSPREE_ENDPOINT = process.env.FORMSPREE_ENDPOINT || 'https://formspree.io/f/xrbykkkb';

async function forwardInquiryToEmail({ name, email, subject, message, inquiryType }) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name,
        email,
        subject: `[${String(inquiryType || 'general').toUpperCase()}] ${subject} - from ${name}`,
        inquiryType: inquiryType || 'general',
        message,
        _replyto: email,
        _subject: `[${String(inquiryType || 'general').toUpperCase()}] ${subject} - from ${name}`,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (response.ok) {
      console.log(`[Email Service] Inquiry forwarded to email via Formspree for: ${email}`);
      return true;
    }
    const errText = await response.text().catch(() => '');
    console.warn(`[Email Service] Formspree responded with ${response.status}: ${errText}`);
    return false;
  } catch (err) {
    console.warn(`[Email Service] Failed to forward inquiry to Formspree:`, err.message);
    return false;
  }
}

// POST new inquiry into MongoDB + Forward to Email
contactRouter.post('/', async (req, res) => {
  const { name, email, subject, message, inquiryType, emailAlreadySent, skipEmail } = req.body || {};

  if (!name || !String(name).trim() || !email || !String(email).trim() || !message || !String(message).trim()) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and message are required fields.',
    });
  }

  try {
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim();
    const cleanSubject = subject && String(subject).trim() ? String(subject).trim() : 'Portfolio Contact Inquiry';
    const cleanMessage = String(message).trim();
    const cleanType = inquiryType ? String(inquiryType).trim() : 'General';

    // Deduplicate repeated automated submissions with identical email + subject + message
    const existingMessages = await MessageModel.find({});
    const duplicate = Array.isArray(existingMessages)
      ? existingMessages.find(
          (m) =>
            String(m.email || '').toLowerCase() === cleanEmail.toLowerCase() &&
            String(m.subject || '').toLowerCase() === cleanSubject.toLowerCase() &&
            String(m.message || '').trim() === cleanMessage
        )
      : null;

    if (duplicate) {
      return res.status(200).json({
        success: true,
        deduplicated: true,
        emailSent: true,
        message: 'Message already received and saved.',
        entry: duplicate,
        data: duplicate,
      });
    }

    const nowIso = new Date().toISOString();
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newDoc = await MessageModel.create({
      _id: msgId,
      id: msgId,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      inquiryType: cleanType,
      emailSent: Boolean(emailAlreadySent),
      timestamp: nowIso,
      createdAt: nowIso,
      status: 'unread',
    });

    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'messages',
      targetId: newDoc._id || newDoc.id,
      targetTitle: `${cleanName} — ${cleanSubject}`,
      before: null,
      after: newDoc,
    });

    // Forward to Formspree in the background so saving to MongoDB is instantaneous
    if (!emailAlreadySent && !skipEmail) {
      forwardInquiryToEmail({
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        inquiryType: cleanType,
      })
        .then((sent) => {
          if (sent) {
            MessageModel.findByIdAndUpdate(msgId, { emailSent: true }).catch(() => null);
          }
        })
        .catch(() => null);
    }

    console.log(`[MongoDB] New inquiry saved to 'messages' collection: ${cleanEmail} (${cleanName})`);
    return res.status(201).json({
      success: true,
      emailSent: true,
      message: 'Message delivered to email and saved to MongoDB.',
      entry: newDoc,
      data: newDoc,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH / PUT mark inquiry as read in MongoDB
const markMessageReadHandler = async (req, res) => {
  const id = decodeURIComponent(req.params.id || '').trim();
  try {
    const updated = await MessageModel.findByIdAndUpdate(id, {
      status: 'read',
      readAt: new Date().toISOString(),
    });
    if (updated) {
      return res.json({ success: true, message: updated, data: updated });
    }
    return res.status(404).json({ success: false, error: 'Message not found' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

contactRouter.patch('/messages/:id/read', markMessageReadHandler);
contactRouter.put('/messages/:id/read', markMessageReadHandler);

// POST /api/contact/messages/clear OR DELETE /api/contact/messages — Clear all contact messages
const clearAllMessagesHandler = async (_req, res) => {
  try {
    const deletedCount = await MessageModel.deleteMany({});
    await AuditLogModel.deleteMany({ collectionName: 'messages' }).catch(() => {});
    return res.json({
      success: true,
      deletedCount,
      message: 'All contact inquiries permanently cleared from MongoDB.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

contactRouter.post('/messages/clear', authenticateAdmin, clearAllMessagesHandler);
contactRouter.delete('/messages', authenticateAdmin, clearAllMessagesHandler);

// DELETE single inquiry from MongoDB (and clean up any audit logs referencing this message)
contactRouter.delete('/messages/:id', authenticateAdmin, async (req, res) => {
  const id = decodeURIComponent(req.params.id || '').trim();
  try {
    const existing = await MessageModel.findById(id);
    await MessageModel.findByIdAndDelete(id);
    if (existing?.id && String(existing.id) !== id) {
      await MessageModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== id) {
      await MessageModel.findByIdAndDelete(String(existing._id));
    }
    // Also remove any audit log referencing this deleted message so deleted message data doesn't linger in audit logs
    const targetIds = new Set([id]);
    if (existing?.id) targetIds.add(String(existing.id));
    if (existing?._id) targetIds.add(String(existing._id));
    for (const tId of targetIds) {
      await AuditLogModel.deleteMany({ targetId: tId }).catch(() => {});
    }
    return res.json({
      success: true,
      id,
      message: 'Inquiry permanently removed from MongoDB database.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

