import { Router } from 'express';
import { MessageModel } from '../models/index.js';
import { recordAuditLog } from '../services/auditLogger.js';

export const contactRouter = Router();

// GET all contact messages from MongoDB (sorted newest first)
contactRouter.get('/messages', async (_req, res) => {
  try {
    const messages = await MessageModel.find({});
    const sorted = Array.isArray(messages)
      ? [...messages].sort((a, b) => {
          const tA = new Date(a.timestamp || a.createdAt || 0).getTime() || 0;
          const tB = new Date(b.timestamp || b.createdAt || 0).getTime() || 0;
          return tB - tA;
        })
      : [];
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
    const nowIso = new Date().toISOString();

    let emailSent = Boolean(emailAlreadySent);
    if (!emailSent && !skipEmail) {
      emailSent = await forwardInquiryToEmail({
        name: cleanName,
        email: cleanEmail,
        subject: cleanSubject,
        message: cleanMessage,
        inquiryType: cleanType,
      });
    }

    const newDoc = await MessageModel.create({
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      email: cleanEmail,
      subject: cleanSubject,
      message: cleanMessage,
      inquiryType: cleanType,
      emailSent,
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

    console.log(`[MongoDB] New inquiry saved to 'messages' collection: ${cleanEmail} (${cleanName}) | Email Sent: ${emailSent}`);
    return res.status(201).json({
      success: true,
      emailSent,
      message: 'Message delivered to email and saved to MongoDB.',
      entry: newDoc,
      data: newDoc,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH mark inquiry as read in MongoDB
contactRouter.patch('/messages/:id/read', async (req, res) => {
  const id = decodeURIComponent(req.params.id || '');
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
});

// DELETE inquiry from MongoDB
contactRouter.delete('/messages/:id', async (req, res) => {
  const id = decodeURIComponent(req.params.id || '');
  try {
    const existing = await MessageModel.findById(id);
    const deleted = await MessageModel.findByIdAndDelete(id);
    if (deleted) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'messages',
        targetId: id,
        targetTitle: existing?.subject ? `${existing.name || 'Visitor'} — ${existing.subject}` : String(id),
        before: existing || null,
        after: null,
      });
      return res.json({ success: true, message: 'Inquiry removed from MongoDB database.' });
    }
    return res.status(404).json({ success: false, error: 'Message not found' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
