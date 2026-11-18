import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  ProjectModel,
  CertificationModel,
  EducationModel,
  ExperienceModel,
  SkillModel,
  ProfileModel,
  MessageModel,
  AuditLogModel,
} from '../models/index.js';
import { db, realtimeBus } from '../db/database.js';
import {
  authenticateAdmin,
  getAuthenticatedAdmin,
  extractClientDeletedSet,
} from '../middleware/auth.js';
import {
  validateProject,
  validateCertification,
  validateEducation,
  validateExperience,
  validateSkill,
} from '../models/validators.js';
import { recordAuditLog } from '../services/auditLogger.js';
import multer from 'multer';
import {
  CLOUDINARY_CERTIFICATES_FOLDER,
  CLOUDINARY_RESUME_FOLDER,
  MAX_PDF_SIZE_BYTES,
  ensureCloudinaryConfigured,
  validateUploadedFile,
  uploadBufferToCloudinary,
  parseCloudinaryUrl,
  deleteFromCloudinary,
  resolveOldCertificateFile,
} from '../services/cloudinaryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT_DIR = path.resolve(__dirname, '../..');
const PUBLIC_CERT_PREVIEWS_DIR = path.resolve(__dirname, '../../public/certificates/previews');

export const portfolioRouter = Router();

// Multer memory storage with 10 MB ceiling (5 MB image limit enforced in validateUploadedFile)
const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_SIZE_BYTES },
});

/**
 * Middleware that parses multipart/form-data (single "file" field) when present,
 * and validates file type (pdf, jpg, jpeg, png, webp) and file size (<=5MB image, <=10MB PDF).
 * Passes through JSON requests untouched.
 */
function handleMultipartFile(req, res, next) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('multipart/form-data')) {
    return next();
  }

  uploadMemory.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File is too large. Maximum allowed size is 5 MB for images and 10 MB for PDFs.',
        });
      }
      return res.status(400).json({
        success: false,
        error: err.message || 'Invalid file upload request.',
      });
    }

    if (req.file) {
      const check = validateUploadedFile(req.file);
      if (!check.valid) {
        return res.status(400).json({
          success: false,
          error: check.error,
        });
      }
    }

    return next();
  });
}

// ==========================================
// 0A. REAL-TIME SERVER-SENT EVENTS STREAM (GET /api/realtime/stream)
// ==========================================
portfolioRouter.get('/realtime/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  const onDbChange = (event) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // ignore closed socket write errors
    }
  };

  realtimeBus.on('change', onDbChange);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // On Vercel Serverless, close the stream cleanly before function timeout; EventSource automatically reconnects
  const vercelTimeout = process.env.VERCEL
    ? setTimeout(() => {
        clearInterval(heartbeat);
        realtimeBus.off('change', onDbChange);
        try {
          res.end();
        } catch {}
      }, 8000)
    : null;

  req.on('close', () => {
    clearInterval(heartbeat);
    if (vercelTimeout) clearTimeout(vercelTimeout);
    realtimeBus.off('change', onDbChange);
  });
});

// ==========================================
// 0B. BINARY PROFILE MEDIA STREAMING (GET /api/profile/media/:field)
// ==========================================
portfolioRouter.get('/profile/media/:field', async (req, res) => {
  try {
    const field = String(req.params.field || '').trim();
    const allowedFields = new Set(['heroImage', 'aboutImage', 'logoImage', 'resumeUrl']);
    if (!allowedFields.has(field)) {
      return res.status(400).json({ success: false, error: 'Unsupported media field' });
    }

    const profile = await ProfileModel.get();
    const rawVal = String(profile?.[field] || '').trim();
    if (!rawVal) {
      return res.status(404).json({ success: false, error: 'Media field is empty' });
    }

    const match = rawVal.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      const mimeType = match[1] || 'application/octet-stream';
      const buf = Buffer.from(match[2], 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.send(buf);
    }

    if (rawVal.includes('/api/profile/media/')) {
      return res.redirect(302, field === 'heroImage' ? '/images/profile-hero.jpg' : '/certificates/resume.pdf');
    }

    if (rawVal.startsWith('/') || rawVal.startsWith('http://') || rawVal.startsWith('https://')) {
      return res.redirect(302, rawVal);
    }

    return res.status(404).json({ success: false, error: 'Media not found' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 0. AGGREGATED PORTFOLIO PAYLOAD (GET /api/portfolio)
// ==========================================

function optimizeProfileForWire(profile, isLight = false) {
  if (!profile || typeof profile !== 'object') return {};
  const clone = { ...profile };
  const versionTag = encodeURIComponent(String(clone.updatedAt || clone.createdAt || 'v1'));
  // Only offload multi-MB PDF resumeUrl in light mode; always send heroImage, aboutImage, logoImage directly so Admin & Frontend update in 0ms
  if (isLight) {
    const val = clone.resumeUrl;
    if (typeof val === 'string' && val.startsWith('data:') && val.length > 500000) {
      clone.resumeUrl = `/api/profile/media/resumeUrl?v=${versionTag}`;
    }
  }
  return clone;
}

function optimizeCertForWire(c) {
  if (!c || typeof c !== 'object') return c;
  const clone = { ...c };
  const certId = encodeURIComponent(String(clone.id || clone._id || ''));
  if (
    typeof clone.file === 'string' &&
    clone.file.startsWith('data:application/pdf') &&
    clone.file.length > 100000 &&
    certId
  ) {
    clone.file = `/api/certifications/${certId}/file.pdf`;
    if (!clone.link || clone.link === '#' || clone.link.startsWith('data:application/pdf')) {
      clone.link = `/api/certifications/${certId}/file.pdf`;
    }
  }

  if (clone.fileUrl && typeof clone.fileUrl === 'string' && clone.fileUrl.trim()) {
    if (!clone.file) clone.file = clone.fileUrl;
    if (!clone.link || clone.link === '#') clone.link = clone.fileUrl;
    if (clone.fileType === 'image' && !clone.image) clone.image = clone.fileUrl;
    if (clone.fileType === 'image' && !clone.preview) clone.preview = clone.fileUrl;
  }

  const rawFile = String(clone.fileUrl || clone.file || clone.link || '').trim().split('?')[0];
  if (
    !clone.preview &&
    !clone.image &&
    rawFile.startsWith('/certificates/') &&
    rawFile.toLowerCase().endsWith('.pdf')
  ) {
    const fileName = rawFile.replace(/^\/certificates\//, '').replace(/\.pdf$/i, '');
    if (fileName && fs.existsSync(path.join(PUBLIC_CERT_PREVIEWS_DIR, `${fileName}.png`))) {
      const derivedPreview = `/certificates/previews/${fileName}.png`;
      clone.preview = derivedPreview;
      clone.image = derivedPreview;
    }
  }
  return clone;
}

function buildAuditStatsSummary(logs = []) {
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
    const col = String(log.collectionName || 'other').toLowerCase();
    if (stats.byCollection[col] !== undefined) {
      stats.byCollection[col]++;
    } else {
      stats.byCollection.other++;
    }

    const act = String(log.action || '').toUpperCase();
    if (stats.byAction[act] !== undefined) {
      stats.byAction[act]++;
    }

    const logTime = new Date(log.timestamp || log.createdAt || 0).getTime();
    if (logTime >= oneDayAgo) {
      stats.recent24h++;
    }
    if (!stats.lastActivity || logTime > new Date(stats.lastActivity).getTime()) {
      stats.lastActivity = log.timestamp || log.createdAt || null;
    }

    const adminName = log.changedBy?.username || 'admin';
    stats.admins[adminName] = (stats.admins[adminName] || 0) + 1;
  }
  return stats;
}

portfolioRouter.get('/portfolio', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const adminUser = getAuthenticatedAdmin(req);
    const clientDeletedSet = extractClientDeletedSet(req);
    const isLight = req.query.light === '1' || req.query.light === 'true';
    const forceSync = req.query.sync === '1' || req.query.force === '1';
    if (forceSync) {
      await db.pullAllFromAtlas(true);
    }

    let [projects, certifications, education, experience, skills, profile, rawMessages, rawAuditLogs, dbHealth] =
      await Promise.all([
        ProjectModel.find(),
        CertificationModel.find(),
        EducationModel.find(),
        ExperienceModel.find(),
        SkillModel.find(),
        ProfileModel.get(),
        adminUser ? MessageModel.find({}) : Promise.resolve([]),
        adminUser ? AuditLogModel.find() : Promise.resolve([]),
        db.getHealth(),
      ]);

    const msgDeletedSet = db.messages.getDeletedSet();
    const auditDeletedSet = db.auditLogs.getDeletedSet();

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

    const activeAuditLogs = adminUser && Array.isArray(rawAuditLogs)
      ? rawAuditLogs.filter((l) => {
          if (!l) return false;
          if (db.auditLogs.isDocDeleted(l, auditDeletedSet)) return false;
          const lId = String(l.id ?? l._id ?? '');
          const lMongoId = String(l._id ?? l.id ?? '');
          const targetId = String(l.targetId ?? '');
          if (
            clientDeletedSet.has(lId) ||
            clientDeletedSet.has(lMongoId) ||
            (targetId && clientDeletedSet.has(targetId))
          ) {
            return false;
          }
          if (
            String(l.collectionName || '').toLowerCase() === 'messages' &&
            targetId &&
            msgDeletedSet.has(targetId)
          ) {
            return false;
          }
          return true;
        })
      : [];

    const cleanExperience = (experience || []).filter((e) => e.role !== 'Senior Full Stack Engineer');
    const wireCertifications = (certifications || []).map(optimizeCertForWire);
    const wireProfile = optimizeProfileForWire(profile, isLight);
    const sortedMessages = [...activeMessages].sort((a, b) => {
      const tA = new Date(a.timestamp || a.createdAt || 0).getTime() || 0;
      const tB = new Date(b.timestamp || b.createdAt || 0).getTime() || 0;
      return tB - tA;
    });
    const sortedAuditLogs = [...activeAuditLogs].sort(
      (a, b) =>
        (new Date(b.timestamp || b.createdAt || 0).getTime() || 0) -
        (new Date(a.timestamp || a.createdAt || 0).getTime() || 0)
    );
    const auditStats = buildAuditStatsSummary(sortedAuditLogs);

    res.json({
      success: true,
      status: 'healthy',
      endpoint: '/api/portfolio',
      authenticatedAdmin: Boolean(adminUser),
      runtime: 'Node.js ' + process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbHealth,
      counts: {
        projects: (projects || []).length,
        certifications: wireCertifications.length,
        education: (education || []).length,
        experience: cleanExperience.length,
        skills: (skills || []).length,
        messages: sortedMessages.length,
      },
      data: {
        profile: wireProfile,
        projects: projects || [],
        experience: cleanExperience,
        skills: skills || [],
        certifications: wireCertifications,
        education: education || [],
        messages: sortedMessages,
        auditLogs: sortedAuditLogs.slice(0, 150),
        auditStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, status: 'error', error: err.message });
  }
});

// ==========================================
// 1. PROJECTS (MongoDB Read: Public | Write: Authenticated Admin Only)
// ==========================================

// Public: GET all projects
portfolioRouter.get('/projects', async (_req, res) => {
  try {
    const projects = await ProjectModel.find();
    res.json({ success: true, count: projects.length, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected: CREATE Project (Restricted to authenticated admin)
portfolioRouter.post('/projects', authenticateAdmin, async (req, res) => {
  try {
    const validation = validateProject(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(' '),
        details: validation.errors,
      });
    }

    const projectId = req.body.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const authorUid = req.user?.username || req.user?.id || 'admin';

    const newProject = await ProjectModel.create({
      ...validation.value,
      id: projectId,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Audit Log: Track who created the project
    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'projects',
      targetId: newProject.id || newProject._id,
      targetTitle: newProject.title,
      after: newProject,
    });

    res.status(201).json({
      success: true,
      message: `Project "${newProject.title}" saved to MongoDB successfully!`,
      data: newProject,
    });
  } catch (err) {
    console.error('[MongoDB POST /projects Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected: UPDATE Project (Restricted to authenticated admin)
portfolioRouter.put('/projects/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await ProjectModel.findById(rawId);

    const mergedCandidate = {
      title: existing?.title || req.body?.title || 'Portfolio Project',
      description:
        existing?.description ||
        req.body?.description ||
        'Full-stack software engineering project by Sachin Kumar.',
      category: existing?.category || req.body?.category || 'Full Stack & MERN Architecture',
      ...(existing || {}),
      ...(req.body || {}),
    };

    const validation = validateProject(mergedCandidate, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(' '),
        details: validation.errors,
      });
    }

    const resolvedId = existing?.id || existing?._id || rawId;
    const updates = {
      ...(existing || {}),
      ...req.body,
      ...validation.value,
      ...(req.body?.seo ? { seo: req.body.seo } : existing?.seo ? { seo: existing.seo } : {}),
      id: resolvedId,
      _id: existing?._id || resolvedId,
      updatedAt: new Date().toISOString(),
    };

    let updated = await ProjectModel.findByIdAndUpdate(resolvedId, updates);
    if (!updated) {
      updated = await ProjectModel.create({
        ...updates,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    }

    if (updated) {
      const modifiedFields = Object.keys(req.body || {});
      await recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'projects',
        targetId: resolvedId,
        targetTitle: updated.title || existing?.title || resolvedId,
        before: existing,
        after: updated,
        modifiedFields,
      });

      return res.json({
        success: true,
        message: `Project "${updated.title}" updated in MongoDB successfully.`,
        data: updated,
      });
    }

    return res.status(404).json({ success: false, error: 'Project not found in database.' });
  } catch (err) {
    console.error('[MongoDB PUT /projects/:id Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real-Time SEO Metadata Endpoints (GET /api/seo & PUT /api/projects/:id/seo)
portfolioRouter.get('/seo', async (_req, res) => {
  try {
    const [projects, profile, dbHealth] = await Promise.all([
      ProjectModel.find(),
      ProfileModel.get(),
      db.getHealth(),
    ]);
    const seoRecords = (projects || []).map((p) => ({
      id: p.id || p._id,
      title: p.title,
      category: p.category,
      seo: p.seo || null,
      updatedAt: p.updatedAt || null,
    }));
    res.json({
      success: true,
      database: dbHealth,
      profileSeo: profile?.seo || null,
      projectsCount: seoRecords.length,
      syncedSeoCount: seoRecords.filter((r) => r.seo && r.seo.metaTitle).length,
      data: seoRecords,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/projects/:id/seo', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const seoPayload = req.body?.seo || req.body || {};
    let existing = await ProjectModel.findById(rawId);

    if (!existing && req.body?.projectTitle) {
      const allProjects = await ProjectModel.find();
      existing =
        allProjects.find(
          (p) =>
            String(p.title || '').toLowerCase() ===
            String(req.body.projectTitle || '').toLowerCase()
        ) || null;
    }

    const resolvedId = existing?.id || existing?._id || rawId;
    const nowIso = new Date().toISOString();
    const sanitizedSeo = {
      metaTitle: String(seoPayload.metaTitle || existing?.title || 'Portfolio Project').trim(),
      metaDescription: String(seoPayload.metaDescription || existing?.description || '').trim(),
      keywords: String(seoPayload.keywords || '').trim(),
      canonicalUrl: String(seoPayload.canonicalUrl || '').trim(),
      ogImage: String(seoPayload.ogImage || existing?.image || '/images/My_portfolio.png').trim(),
      twitterCard: String(seoPayload.twitterCard || 'summary_large_image').trim(),
      robots: String(seoPayload.robots || 'index, follow').trim(),
      schemaType: String(seoPayload.schemaType || 'WebApplication').trim(),
      author: String(seoPayload.author || 'Sachin Kumar').trim(),
      updatedAt: nowIso,
    };

    let updated = null;
    if (existing) {
      updated = await ProjectModel.findByIdAndUpdate(resolvedId, {
        ...existing,
        seo: sanitizedSeo,
        updatedAt: nowIso,
      });
    } else {
      updated = await ProjectModel.create({
        id: resolvedId,
        _id: resolvedId,
        title: req.body?.projectTitle || sanitizedSeo.metaTitle.split('–')[0].trim() || resolvedId,
        description: sanitizedSeo.metaDescription || 'Portfolio Project',
        category: req.body?.category || 'Full Stack & MERN Architecture',
        image: sanitizedSeo.ogImage || '/images/My_portfolio.png',
        technologies: ['React', 'Node.js', 'MongoDB'],
        seo: sanitizedSeo,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    await recordAuditLog({
      req,
      action: 'UPDATE',
      collectionName: 'projects',
      targetId: resolvedId,
      targetTitle: `${updated?.title || resolvedId} (SEO & Social Meta)`,
      before: existing,
      after: updated,
      modifiedFields: ['seo', 'updatedAt'],
    });

    const dbHealth = await db.getHealth();
    return res.json({
      success: true,
      message: `SEO metadata for "${updated?.title || resolvedId}" synced in real-time to MongoDB (${dbHealth.databaseName})!`,
      data: updated,
      database: dbHealth,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error('[MongoDB PUT /projects/:id/seo Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected: DELETE Project (Restricted to authenticated admin)
portfolioRouter.delete('/projects/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await ProjectModel.findById(rawId);
    const deleted = await ProjectModel.findByIdAndDelete(rawId);
    if (existing?.id && String(existing.id) !== rawId) {
      await ProjectModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== rawId) {
      await ProjectModel.findByIdAndDelete(String(existing._id));
    }
    if (deleted || existing) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'projects',
        targetId: existing?.id || existing?._id || rawId,
        targetTitle: existing?.title || rawId,
        before: existing,
      });
    }
    return res.json({
      success: true,
      message: 'Project deleted permanently from MongoDB database.',
    });
  } catch (err) {
    console.error('[MongoDB DELETE /projects/:id Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 2. CERTIFICATIONS (MongoDB Read: Public | Write: Authenticated Admin Only)
// ==========================================

portfolioRouter.get('/certifications', async (_req, res) => {
  try {
    const certs = await CertificationModel.find();
    const wireCerts = (certs || []).map(optimizeCertForWire);
    res.json({ success: true, count: wireCerts.length, data: wireCerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Serve large base64 PDF/image certificate directly as binary HTTP stream
portfolioRouter.get(['/certifications/:id/file.pdf', '/certifications/:id/file'], async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const cert = await CertificationModel.findById(rawId);
    if (!cert) {
      return res.status(404).send('Certificate not found');
    }
    const rawMedia = cert.file || cert.image || cert.preview || '';
    const match = typeof rawMedia === 'string' ? rawMedia.match(/^data:([^;]+);base64,(.+)$/) : null;
    if (match) {
      const mimeType = match[1] || 'application/pdf';
      const base64Data = match[2];
      const buf = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', buf.length);
      res.setHeader('Content-Disposition', 'inline; filename="certificate.pdf"');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(buf);
    }
    if (typeof rawMedia === 'string' && (rawMedia.startsWith('http') || rawMedia.startsWith('/'))) {
      return res.redirect(rawMedia);
    }
    return res.status(404).send('Certificate file not available');
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

portfolioRouter.post('/certifications', authenticateAdmin, handleMultipartFile, async (req, res) => {
  let uploadedAsset = null;
  try {
    const bodyData = { ...(req.body || {}) };

    // If a file was uploaded via multipart/form-data, upload to Cloudinary folder "portfolio/certificates"
    if (req.file) {
      uploadedAsset = await uploadBufferToCloudinary(req.file, CLOUDINARY_CERTIFICATES_FOLDER);
      bodyData.fileUrl = uploadedAsset.fileUrl;
      bodyData.publicId = uploadedAsset.publicId;
      bodyData.resourceType = uploadedAsset.resourceType;
      bodyData.fileType = uploadedAsset.fileType;
      bodyData.originalName = uploadedAsset.originalName;
      bodyData.file = uploadedAsset.fileUrl;
      if (uploadedAsset.fileType === 'image') {
        bodyData.image = uploadedAsset.fileUrl;
        bodyData.preview = bodyData.preview || uploadedAsset.fileUrl;
      } else {
        bodyData.image = bodyData.preview || '';
      }
      if (!bodyData.link) {
        bodyData.link = uploadedAsset.fileUrl;
      }
    }

    const validation = validateCertification(bodyData, false);
    if (!validation.isValid) {
      if (uploadedAsset?.publicId) {
        await deleteFromCloudinary(uploadedAsset.publicId, uploadedAsset.resourceType);
      }
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const nowIso = new Date().toISOString();
    const certId = bodyData.id || `cert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newCert = await CertificationModel.create({
      ...bodyData,
      ...validation.value,
      id: certId,
      authorUid: req.user?.username || 'admin',
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'certifications',
      targetId: newCert.id || newCert._id,
      targetTitle: `${newCert.title} (${newCert.issuer || 'Credential'})`,
      after: newCert,
    });

    const wireNewCert = optimizeCertForWire(newCert);
    return res.status(201).json({
      success: true,
      message: `Certification "${newCert.title}" saved to MongoDB!`,
      data: wireNewCert,
    });
  } catch (err) {
    // Roll back Cloudinary upload if DB save failed so no orphan files remain
    if (uploadedAsset?.publicId) {
      await deleteFromCloudinary(uploadedAsset.publicId, uploadedAsset.resourceType).catch(() => {});
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/certifications/:id', authenticateAdmin, handleMultipartFile, async (req, res) => {
  let uploadedAsset = null;
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await CertificationModel.findById(rawId);

    const bodyData = { ...(req.body || {}) };

    // When replacing the file: upload the new one to Cloudinary FIRST
    if (req.file) {
      uploadedAsset = await uploadBufferToCloudinary(req.file, CLOUDINARY_CERTIFICATES_FOLDER);
      bodyData.fileUrl = uploadedAsset.fileUrl;
      bodyData.publicId = uploadedAsset.publicId;
      bodyData.resourceType = uploadedAsset.resourceType;
      bodyData.fileType = uploadedAsset.fileType;
      bodyData.originalName = uploadedAsset.originalName;
      // Update legacy link fields too so old consumers stay in sync
      bodyData.file = uploadedAsset.fileUrl;
      if (uploadedAsset.fileType === 'image') {
        bodyData.image = uploadedAsset.fileUrl;
        bodyData.preview = uploadedAsset.fileUrl;
      } else {
        bodyData.image = bodyData.preview || '';
        bodyData.preview = bodyData.preview || '';
      }
      bodyData.link = bodyData.link || uploadedAsset.fileUrl;
    }

    const mergedCandidate = {
      title: existing?.title || bodyData?.title || 'Professional Certification',
      issuer: existing?.issuer || bodyData?.issuer || 'Credential Authority',
      ...(existing || {}),
      ...bodyData,
    };

    const validation = validateCertification(mergedCandidate, true);
    if (!validation.isValid) {
      if (uploadedAsset?.publicId) {
        await deleteFromCloudinary(uploadedAsset.publicId, uploadedAsset.resourceType);
      }
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const targetId = existing?.id || existing?._id || rawId;
    const payload = {
      ...(existing || {}),
      ...bodyData,
      ...validation.value,
      id: targetId,
      _id: existing?._id || targetId,
      updatedAt: new Date().toISOString(),
    };

    let updated = await CertificationModel.findByIdAndUpdate(targetId, payload);
    if (!updated) {
      updated = await CertificationModel.create({
        ...payload,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    }

    // If a new file was uploaded and saved to DB, delete the old file from Cloudinary
    if (uploadedAsset && existing) {
      let oldPublicId = existing.publicId || '';
      let oldResourceType = existing.resourceType || (existing.fileType === 'pdf' ? 'raw' : 'image');

      if (!oldPublicId) {
        const oldUrlCandidate =
          existing.fileUrl || existing.file || existing.image || existing.preview || existing.link || '';
        const parsedOld = parseCloudinaryUrl(oldUrlCandidate);
        if (parsedOld) {
          oldPublicId = parsedOld.publicId;
          oldResourceType = parsedOld.resourceType;
        }
      }

      if (oldPublicId && oldPublicId !== uploadedAsset.publicId) {
        await deleteFromCloudinary(oldPublicId, oldResourceType);
      }
    }

    if (updated) {
      await recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'certifications',
        targetId,
        targetTitle: `${updated.title || existing?.title || targetId} (${updated.issuer || existing?.issuer || 'Credential'})`,
        before: existing,
        after: updated,
        modifiedFields: Object.keys(bodyData || {}),
      });
      return res.json({
        success: true,
        data: optimizeCertForWire(updated),
        message: 'Certification updated in MongoDB',
      });
    }
    return res.status(404).json({ success: false, error: 'Certification not found' });
  } catch (err) {
    if (uploadedAsset?.publicId) {
      await deleteFromCloudinary(uploadedAsset.publicId, uploadedAsset.resourceType).catch(() => {});
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
});

portfolioRouter.delete('/certifications/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await CertificationModel.findById(rawId);

    let cloudinaryDeleted = false;
    let cloudinaryNotice = null;

    if (existing) {
      if (existing.publicId) {
        // 1. Stored publicId exists -> delete from Cloudinary first
        const resType =
          existing.resourceType || (existing.fileType === 'pdf' ? 'raw' : 'image');
        const delResult = await deleteFromCloudinary(existing.publicId, resType);
        cloudinaryDeleted = Boolean(delResult.deleted);
      } else {
        // 2. Old record without publicId -> try deriving publicId & resourceType from old Cloudinary URL
        const candidateUrls = [
          existing.fileUrl,
          existing.file,
          existing.image,
          existing.preview,
          existing.link,
        ].filter((u) => typeof u === 'string' && u.trim());

        let parsedCloudinary = null;
        for (const url of candidateUrls) {
          parsedCloudinary = parseCloudinaryUrl(url);
          if (parsedCloudinary) break;
        }

        if (parsedCloudinary) {
          const delResult = await deleteFromCloudinary(
            parsedCloudinary.publicId,
            parsedCloudinary.resourceType
          );
          cloudinaryDeleted = Boolean(delResult.deleted);
          if (!cloudinaryDeleted) {
            cloudinaryNotice =
              'Certificate deleted from database. The derived Cloudinary file was already missing or could not be removed from Cloudinary.';
          }
        } else {
          // Old link is not a Cloudinary URL (or parsing failed) -> skip Cloudinary deletion, delete DB record
          cloudinaryNotice =
            'Certificate deleted from database. The old file was not a Cloudinary URL, so it was not removed from Cloudinary.';
        }
      }
    }

    const deleted = await CertificationModel.findByIdAndDelete(rawId);
    if (existing?.id && String(existing.id) !== rawId) {
      await CertificationModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== rawId) {
      await CertificationModel.findByIdAndDelete(String(existing._id));
    }
    if (deleted || existing) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'certifications',
        targetId: existing?.id || existing?._id || rawId,
        targetTitle: existing ? `${existing.title} (${existing.issuer || 'Credential'})` : rawId,
        before: existing,
      });
    }
    return res.json({
      success: true,
      cloudinaryDeleted,
      notice: cloudinaryNotice,
      message: cloudinaryNotice || 'Certification deleted from Cloudinary and MongoDB.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// One-time idempotent migration endpoint for old certificates in MongoDB Atlas
portfolioRouter.post('/admin/migrate-certificates', authenticateAdmin, async (req, res) => {
  try {
    const allCerts = await CertificationModel.find();
    let updatedCount = 0;
    let skippedCount = 0;
    const details = [];

    for (const cert of allCerts) {
      const docId = cert._id || cert.id;
      if (!docId) {
        skippedCount++;
        continue;
      }

      // Already has publicId, resourceType, fileUrl, and fileType -> idempotent skip
      if (cert.publicId && cert.resourceType && cert.fileUrl && cert.fileType) {
        skippedCount++;
        details.push({
          id: String(docId),
          title: cert.title,
          status: 'skipped_already_migrated',
          publicId: cert.publicId,
        });
        continue;
      }

      const candidateUrls = [
        cert.fileUrl,
        cert.file,
        cert.image,
        cert.preview,
        cert.link,
      ].filter((u) => typeof u === 'string' && u.trim());

      let parsed = null;
      for (const url of candidateUrls) {
        parsed = parseCloudinaryUrl(url);
        if (parsed) break;
      }

      // Do NOT modify documents that do not have a parseable Cloudinary URL
      if (!parsed) {
        skippedCount++;
        details.push({
          id: String(docId),
          title: cert.title,
          status: 'skipped_non_cloudinary_url',
        });
        continue;
      }

      let derivedOriginalName = cert.originalName || '';
      if (!derivedOriginalName) {
        try {
          derivedOriginalName = path.basename(decodeURIComponent(new URL(parsed.fileUrl).pathname));
        } catch {
          derivedOriginalName = '';
        }
      }

      const setFields = {
        fileUrl: cert.fileUrl || parsed.fileUrl,
        publicId: cert.publicId || parsed.publicId,
        resourceType: cert.resourceType || parsed.resourceType,
        fileType: cert.fileType || parsed.fileType,
        ...(derivedOriginalName ? { originalName: derivedOriginalName } : {}),
      };

      await CertificationModel.updateOne({ _id: docId }, setFields);
      updatedCount++;
      details.push({
        id: String(docId),
        title: cert.title,
        status: 'updated',
        ...setFields,
      });
    }

    console.log(
      `[Migrate Certificates] Examined=${allCerts.length}, Updated=${updatedCount}, Skipped=${skippedCount}`
    );

    if (updatedCount > 0) {
      await recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'certifications',
        targetId: 'migration_batch',
        targetTitle: `Migrated ${updatedCount} legacy Cloudinary certificates (Skipped ${skippedCount})`,
        modifiedFields: ['fileUrl', 'publicId', 'resourceType', 'fileType', 'originalName'],
      });
    }

    return res.json({
      success: true,
      totalExamined: allCerts.length,
      updatedCount,
      skippedCount,
      message: `Migration complete: ${updatedCount} certificate(s) updated, ${skippedCount} skipped.`,
      details,
    });
  } catch (err) {
    console.error('[Migrate Certificates Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// One-time admin-only BULK UPLOAD migration endpoint that moves OLD certificate files
// (not yet on Cloudinary) from local public/certificates or external URLs to Cloudinary
portfolioRouter.post('/admin/bulk-upload-certificates', authenticateAdmin, async (req, res) => {
  try {
    const rawDryRun = req.body?.dryRun;
    const dryRun = rawDryRun === false || rawDryRun === 'false' ? false : true;
    const rawLimit = req.body?.limit;
    const parsedLimit =
      rawLimit !== undefined && rawLimit !== null && String(rawLimit).trim() !== ''
        ? Number(rawLimit)
        : null;
    const hasValidLimit =
      parsedLimit !== null && Number.isFinite(parsedLimit) && parsedLimit > 0;

    if (!dryRun && !ensureCloudinaryConfigured()) {
      return res.status(500).json({
        success: false,
        error:
          'Cloudinary is not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in environment variables before running the live upload.',
      });
    }

    const allCerts = await CertificationModel.find();
    let totalChecked = 0;
    let eligible = 0;
    let uploaded = 0;
    let wouldUpload = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const cert of allCerts) {
      totalChecked++;
      const docId = cert._id || cert.id;
      const docTitle = cert.title || String(docId || 'Untitled Certificate');

      if (!docId) {
        skipped++;
        results.push({
          _id: '',
          title: docTitle,
          oldSource: '',
          status: 'skipped',
          reason: 'Document has no _id',
          newUrl: null,
        });
        continue;
      }

      // 1. Skip documents that already have a non-empty publicId
      if (cert.publicId && String(cert.publicId).trim() !== '') {
        skipped++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource: cert.legacyFileUrl || cert.fileUrl || cert.file || cert.image || '',
          status: 'skipped',
          reason: `Already on Cloudinary (publicId: ${cert.publicId})`,
          newUrl: cert.fileUrl || cert.file || null,
        });
        continue;
      }

      // 2. Find usable old file reference in priority order: fileUrl, file, image, preview, link, credentialUrl
      const candidateFields = [
        cert.fileUrl,
        cert.file,
        cert.image,
        cert.preview,
        cert.link,
        cert.credentialUrl,
      ];

      let oldSource = '';
      let existingCloudinaryUrl = '';

      for (const rawVal of candidateFields) {
        if (typeof rawVal !== 'string') continue;
        const val = rawVal.trim();
        if (!val || val === '#' || val.startsWith('/api/certifications/')) continue;
        if (parseCloudinaryUrl(val)) {
          existingCloudinaryUrl = val;
          break;
        }
        if (!oldSource) {
          oldSource = val;
        }
      }

      // Skip documents whose file is already a Cloudinary URL (handled by /api/admin/migrate-certificates)
      if (existingCloudinaryUrl) {
        skipped++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource: existingCloudinaryUrl,
          status: 'skipped',
          reason: 'File is already a Cloudinary URL (use Migrate Legacy Cloudinary URLs)',
          newUrl: existingCloudinaryUrl,
        });
        continue;
      }

      // Skip documents that have no usable file reference
      if (!oldSource) {
        skipped++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource: '',
          status: 'skipped',
          reason: 'No usable file reference found in fileUrl, file, image, preview, or link',
          newUrl: null,
        });
        continue;
      }

      // Enforce optional batch limit on eligible documents
      if (hasValidLimit && eligible >= parsedLimit) {
        skipped++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource,
          status: 'skipped',
          reason: `Skipped due to batch limit (${parsedLimit})`,
          newUrl: null,
        });
        continue;
      }

      // Document is eligible for migration
      eligible++;

      // 3. Resolve & validate the old file (local path, Google Drive link, or public http/https URL)
      const resolved = await resolveOldCertificateFile(oldSource, PROJECT_ROOT_DIR);
      if (!resolved.valid) {
        if (resolved.failureKind === 'skipped') {
          skipped++;
          results.push({
            _id: String(docId),
            title: docTitle,
            oldSource,
            status: 'skipped',
            reason: resolved.error || 'Unsupported file type or size limit exceeded',
            newUrl: null,
          });
        } else {
          failed++;
          results.push({
            _id: String(docId),
            title: docTitle,
            oldSource,
            status: 'failed',
            reason: resolved.error || 'Could not resolve or download old file',
            newUrl: null,
          });
        }
        continue;
      }

      // 4. Dry-run mode: report "would-upload" without uploading or modifying MongoDB
      if (dryRun) {
        wouldUpload++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource,
          status: 'would-upload',
          reason: `Valid ${resolved.fileType.toUpperCase()} (${(resolved.size / 1024).toFixed(1)} KB, ${resolved.originalName}) ready to upload`,
          newUrl: null,
        });
        continue;
      }

      // 5. Live run (dryRun === false): upload sequentially to Cloudinary & update MongoDB with $set
      let uploadedAsset = null;
      try {
        uploadedAsset = await uploadBufferToCloudinary(
          {
            buffer: resolved.buffer,
            originalname: resolved.originalName,
            mimetype: resolved.mimetype,
            size: resolved.size,
          },
          CLOUDINARY_CERTIFICATES_FOLDER
        );

        const nowIso = new Date().toISOString();
        const setFields = {
          fileUrl: uploadedAsset.fileUrl,
          publicId: uploadedAsset.publicId,
          resourceType: uploadedAsset.resourceType,
          fileType: uploadedAsset.fileType,
          originalName: uploadedAsset.originalName,
          updatedAt: nowIso,
        };

        // Preserve original value in legacyFileUrl only if not already set
        if (!cert.legacyFileUrl) {
          setFields.legacyFileUrl = oldSource;
        }

        // Update legacy link fields (file, image, preview, link) ONLY IF they were pointing to the old file
        for (const legacyField of ['file', 'image', 'preview', 'link']) {
          if (typeof cert[legacyField] === 'string' && cert[legacyField].trim() === oldSource) {
            setFields[legacyField] = uploadedAsset.fileUrl;
          }
        }

        const updatedDoc = await CertificationModel.updateOne({ _id: docId }, setFields);
        if (!updatedDoc) {
          throw new Error('MongoDB updateOne returned no matching document.');
        }

        uploaded++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource,
          status: 'uploaded',
          reason: `Uploaded ${resolved.fileType.toUpperCase()} (${(resolved.size / 1024).toFixed(1)} KB) to ${uploadedAsset.publicId}`,
          newUrl: uploadedAsset.fileUrl,
        });
      } catch (uploadOrDbErr) {
        // If DB update failed after Cloudinary upload, delete the just-uploaded Cloudinary file (no orphans)
        if (uploadedAsset?.publicId) {
          await deleteFromCloudinary(uploadedAsset.publicId, uploadedAsset.resourceType).catch(() => {});
        }
        failed++;
        results.push({
          _id: String(docId),
          title: docTitle,
          oldSource,
          status: 'failed',
          reason: uploadOrDbErr.message || 'Upload or database update failed',
          newUrl: null,
        });
      }

      // Small sequential delay to avoid Cloudinary / network rate limits
      await new Promise((resolve) => setTimeout(resolve, 180));
    }

    console.log(
      `[Bulk Upload Certificates] dryRun=${dryRun}, totalChecked=${totalChecked}, eligible=${eligible}, uploaded=${uploaded}, wouldUpload=${wouldUpload}, skipped=${skipped}, failed=${failed}`
    );

    if (!dryRun && uploaded > 0) {
      await recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'certifications',
        targetId: 'bulk_upload_certificates',
        targetTitle: `Bulk uploaded ${uploaded} old certificate(s) to Cloudinary (Skipped: ${skipped}, Failed: ${failed})`,
        modifiedFields: ['fileUrl', 'publicId', 'resourceType', 'fileType', 'originalName', 'legacyFileUrl'],
      });
    }

    return res.json({
      success: true,
      dryRun,
      totalChecked,
      eligible,
      uploaded,
      wouldUpload,
      skipped,
      failed,
      results,
      documents: results,
    });
  } catch (err) {
    console.error('[Bulk Upload Certificates Error]:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 3. EDUCATION (MongoDB Read: Public | Write: Authenticated Admin Only)
// ==========================================

portfolioRouter.get('/education', async (_req, res) => {
  try {
    const education = await EducationModel.find();
    res.json({ success: true, count: education.length, data: education });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.post('/education', authenticateAdmin, async (req, res) => {
  try {
    const validation = validateEducation(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const eduId = req.body.id || `edu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newEdu = await EducationModel.create({
      ...req.body,
      ...validation.value,
      id: eduId,
      authorUid: req.user?.username || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'education',
      targetId: newEdu.id || newEdu._id,
      targetTitle: `${newEdu.degree || newEdu.title} — ${newEdu.institution || newEdu.institute}`,
      after: newEdu,
    });

    res.status(201).json({ success: true, data: newEdu });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/education/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await EducationModel.findById(rawId);

    const mergedCandidate = {
      degree: existing?.degree || existing?.title || req.body?.degree || req.body?.title || 'Degree Program',
      institution:
        existing?.institution ||
        existing?.institute ||
        req.body?.institution ||
        req.body?.institute ||
        'Academic Institution',
      ...(existing || {}),
      ...(req.body || {}),
    };

    const validation = validateEducation(mergedCandidate, true);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const targetId = existing?.id || existing?._id || rawId;
    const payload = {
      ...(existing || {}),
      ...req.body,
      ...validation.value,
      id: targetId,
      _id: existing?._id || targetId,
      updatedAt: new Date().toISOString(),
    };

    let updated = await EducationModel.findByIdAndUpdate(targetId, payload);
    if (!updated) {
      updated = await EducationModel.create({
        ...payload,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    }

    if (updated) {
      await recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'education',
        targetId,
        targetTitle: `${updated.degree || existing?.degree || targetId} — ${updated.institution || existing?.institution || ''}`,
        before: existing,
        after: updated,
        modifiedFields: Object.keys(req.body || {}),
      });
      return res.json({ success: true, data: updated, message: 'Education updated in MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Record not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.delete('/education/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await EducationModel.findById(rawId);
    const deleted = await EducationModel.findByIdAndDelete(rawId);
    if (existing?.id && String(existing.id) !== rawId) {
      await EducationModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== rawId) {
      await EducationModel.findByIdAndDelete(String(existing._id));
    }
    if (deleted || existing) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'education',
        targetId: existing?.id || existing?._id || rawId,
        targetTitle: existing ? `${existing.degree || existing.title} — ${existing.institution || existing.institute}` : rawId,
        before: existing,
      });
    }
    return res.json({ success: true, message: 'Education record deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 4. EXPERIENCE (MongoDB Read: Public | Write: Authenticated Admin Only)
// ==========================================

portfolioRouter.get('/experience', async (_req, res) => {
  try {
    let experience = await ExperienceModel.find();
    if (!experience || experience.length === 0) {
      await db.syncInitialExperiences();
      experience = await ExperienceModel.find();
    }
    const cleanExperience = (experience || []).filter((e) => e.role !== 'Senior Full Stack Engineer');
    res.json({ success: true, count: cleanExperience.length, data: cleanExperience });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.post('/experience', authenticateAdmin, async (req, res) => {
  try {
    const validation = validateExperience(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const expId = req.body.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newExp = await ExperienceModel.create({
      ...req.body,
      ...validation.value,
      id: expId,
      authorUid: req.user?.username || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Audit Log: Track who created the experience record
    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'experience',
      targetId: newExp.id || newExp._id,
      targetTitle: `${newExp.role || newExp.title} at ${newExp.company}`,
      after: newExp,
    });

    res.status(201).json({ success: true, data: newExp });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/experience/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await ExperienceModel.findById(rawId);

    const mergedCandidate = {
      role: existing?.role || existing?.title || req.body?.role || req.body?.title || 'Software Engineer',
      company: existing?.company || req.body?.company || 'Organization',
      ...(existing || {}),
      ...(req.body || {}),
    };

    const validation = validateExperience(mergedCandidate, true);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const targetId = existing?.id || existing?._id || rawId;
    const payload = {
      ...(existing || {}),
      ...req.body,
      ...validation.value,
      id: targetId,
      _id: existing?._id || targetId,
      updatedAt: new Date().toISOString(),
    };

    let updated = await ExperienceModel.findByIdAndUpdate(targetId, payload);
    if (!updated) {
      updated = await ExperienceModel.create({
        ...payload,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
    }

    if (updated) {
      const modifiedFields = Object.keys(req.body || {});
      await recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'experience',
        targetId,
        targetTitle: `${updated.role || updated.title || existing?.role || targetId} at ${updated.company || existing?.company || ''}`,
        before: existing,
        after: updated,
        modifiedFields,
      });

      return res.json({ success: true, data: updated, message: 'Experience updated in MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Experience not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.delete('/experience/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await ExperienceModel.findById(rawId);
    const deleted = await ExperienceModel.findByIdAndDelete(rawId);
    if (existing?.id && String(existing.id) !== rawId) {
      await ExperienceModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== rawId) {
      await ExperienceModel.findByIdAndDelete(String(existing._id));
    }
    if (deleted || existing) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'experience',
        targetId: existing?.id || existing?._id || rawId,
        targetTitle: existing ? `${existing.role || existing.title} at ${existing.company}` : rawId,
        before: existing,
      });
    }
    return res.json({ success: true, message: 'Experience deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 5. SKILLS (MongoDB Read: Public | Write: Authenticated Admin Only)
// ==========================================

portfolioRouter.get('/skills', async (_req, res) => {
  try {
    let skills = await SkillModel.find();
    if (!skills || skills.length === 0) {
      await db.syncInitialSkills();
      skills = await SkillModel.find();
    }
    res.json({ success: true, count: skills.length, data: skills });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.post('/skills', authenticateAdmin, async (req, res) => {
  try {
    const validation = validateSkill(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const skillId = req.body.id || `skill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newSkill = await SkillModel.create({
      ...req.body,
      ...validation.value,
      id: skillId,
      _id: skillId,
      authorUid: req.user?.username || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'skills',
      targetId: newSkill.id || newSkill._id,
      targetTitle: `${newSkill.name} (${newSkill.domainTitle || newSkill.domainId || 'Skill'})`,
      after: newSkill,
    });

    res.status(201).json({ success: true, data: newSkill });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/skills/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await SkillModel.findById(rawId);
    const mergedInput = {
      ...(existing || {}),
      ...req.body,
      highlight:
        req.body.highlight !== undefined
          ? Boolean(req.body.highlight)
          : req.body.featured !== undefined
          ? Boolean(req.body.featured)
          : Boolean(existing?.highlight || existing?.featured),
      featured:
        req.body.featured !== undefined
          ? Boolean(req.body.featured)
          : req.body.highlight !== undefined
          ? Boolean(req.body.highlight)
          : Boolean(existing?.featured || existing?.highlight),
    };

    const validation = validateSkill(mergedInput, true);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const targetId = existing?.id || existing?._id || rawId;
    let updated = await SkillModel.findByIdAndUpdate(targetId, {
      ...(existing || {}),
      ...req.body,
      ...validation.value,
      id: targetId,
      _id: targetId,
      updatedAt: new Date().toISOString(),
    });

    if (!updated) {
      updated = await SkillModel.create({
        ...req.body,
        ...validation.value,
        id: targetId,
        _id: targetId,
        authorUid: req.user?.username || 'admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await recordAuditLog({
      req,
      action: 'UPDATE',
      collectionName: 'skills',
      targetId: updated.id || updated._id || rawId,
      targetTitle: `${updated.name || existing?.name || rawId} (${updated.domainTitle || updated.domainId || 'Skill'})`,
      before: existing,
      after: updated,
      modifiedFields: Object.keys(req.body || {}),
    });

    return res.json({ success: true, data: updated, message: 'Skill updated in MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.delete('/skills/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await SkillModel.findById(rawId);
    const deleted = await SkillModel.findByIdAndDelete(rawId);
    if (existing?.id && String(existing.id) !== rawId) {
      await SkillModel.findByIdAndDelete(String(existing.id));
    }
    if (existing?._id && String(existing._id) !== rawId) {
      await SkillModel.findByIdAndDelete(String(existing._id));
    }
    if (deleted || existing) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'skills',
        targetId: existing?.id || existing?._id || rawId,
        targetTitle: existing ? `${existing.name} (${existing.domainTitle || existing.domainId || 'Skill'})` : rawId,
        before: existing,
      });
    }
    return res.json({ success: true, message: 'Skill deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6. PROFILE & PHOTOS (MongoDB Read: Public | Write: Authenticated Admin Only)
// ==========================================

portfolioRouter.get('/profile', async (_req, res) => {
  try {
    const profile = await ProfileModel.get();
    res.json({ success: true, data: profile });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/profile', authenticateAdmin, async (req, res) => {
  try {
    const existing = await ProfileModel.get();
    const updated = await ProfileModel.update({
      ...req.body,
      authorUid: req.user?.username || 'admin',
      updatedAt: new Date().toISOString(),
    });
    await recordAuditLog({
      req,
      action: 'UPDATE',
      collectionName: 'profile',
      targetId: 'config',
      targetTitle: `Profile & Photos Configuration (${updated?.name || 'Sachin Kumar'})`,
      before: existing,
      after: updated,
      modifiedFields: Object.keys(req.body || {}),
    });
    res.json({ success: true, data: updated, message: 'Profile updated in MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 6B. RESUME MANAGEMENT (Single Active Item: Public Read | Admin Add/Replace/Delete via Cloudinary)
// ==========================================

portfolioRouter.get('/resume', async (_req, res) => {
  try {
    const profile = await ProfileModel.get();
    const resumeData = profile?.resume || {
      fileUrl: profile?.resumeUrl || '',
      publicId: profile?.resumePublicId || '',
      resourceType: profile?.resumeResourceType || '',
      fileType: profile?.resumeFileType || (String(profile?.resumeUrl || '').toLowerCase().endsWith('.pdf') ? 'pdf' : ''),
      originalName: profile?.resumeOriginalName || '',
      createdAt: profile?.createdAt || null,
      updatedAt: profile?.updatedAt || null,
    };
    return res.json({
      success: true,
      data: resumeData,
      resumeUrl: resumeData.fileUrl || profile?.resumeUrl || '',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const handleSaveOrReplaceResume = async (req, res) => {
  let uploadedAsset = null;
  try {
    const existingProfile = await ProfileModel.get();
    const nowIso = new Date().toISOString();

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please select a valid Resume file (PDF, JPG, JPEG, PNG, or WEBP) to upload.',
      });
    }

    // 1. Upload the new resume to Cloudinary folder "portfolio/resume" FIRST
    uploadedAsset = await uploadBufferToCloudinary(req.file, CLOUDINARY_RESUME_FOLDER);

    const resumeMetadata = {
      fileUrl: uploadedAsset.fileUrl,
      publicId: uploadedAsset.publicId,
      resourceType: uploadedAsset.resourceType,
      fileType: uploadedAsset.fileType,
      originalName: uploadedAsset.originalName,
      createdAt: existingProfile?.resume?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    // 2. Save the new resume link and metadata in the database
    const updatedProfile = await ProfileModel.update({
      resumeUrl: uploadedAsset.fileUrl,
      resume: resumeMetadata,
      fileUrl: uploadedAsset.fileUrl,
      publicId: uploadedAsset.publicId,
      resourceType: uploadedAsset.resourceType,
      fileType: uploadedAsset.fileType,
      originalName: uploadedAsset.originalName,
      authorUid: req.user?.username || 'admin',
      updatedAt: nowIso,
    });

    // 3. Delete the old Cloudinary resume file if one existed previously
    const oldResume = existingProfile?.resume;
    let oldPublicId = oldResume?.publicId || existingProfile?.publicId || '';
    let oldResourceType =
      oldResume?.resourceType ||
      existingProfile?.resourceType ||
      (oldResume?.fileType === 'pdf' ? 'raw' : 'image');

    if (!oldPublicId) {
      const oldUrlCandidate = oldResume?.fileUrl || existingProfile?.resumeUrl || '';
      const parsedOld = parseCloudinaryUrl(oldUrlCandidate);
      if (parsedOld) {
        oldPublicId = parsedOld.publicId;
        oldResourceType = parsedOld.resourceType;
      }
    }

    if (oldPublicId && oldPublicId !== uploadedAsset.publicId) {
      await deleteFromCloudinary(oldPublicId, oldResourceType);
    }

    await recordAuditLog({
      req,
      action: existingProfile?.resumeUrl ? 'UPDATE' : 'CREATE',
      collectionName: 'profile',
      targetId: 'resume',
      targetTitle: `Official Resume (${uploadedAsset.originalName})`,
      before: existingProfile?.resume || { resumeUrl: existingProfile?.resumeUrl },
      after: resumeMetadata,
      modifiedFields: ['resumeUrl', 'resume'],
    });

    return res.json({
      success: true,
      message: 'Resume uploaded to Cloudinary and saved to MongoDB!',
      data: updatedProfile,
      resume: resumeMetadata,
    });
  } catch (err) {
    // Avoid orphan files if DB save fails after upload
    if (uploadedAsset?.publicId) {
      await deleteFromCloudinary(uploadedAsset.publicId, uploadedAsset.resourceType).catch(() => {});
    }
    const status = err.statusCode || 500;
    return res.status(status).json({ success: false, error: err.message });
  }
};

portfolioRouter.post('/resume', authenticateAdmin, handleMultipartFile, handleSaveOrReplaceResume);
portfolioRouter.put('/resume', authenticateAdmin, handleMultipartFile, handleSaveOrReplaceResume);

portfolioRouter.delete('/resume', authenticateAdmin, async (req, res) => {
  try {
    const existingProfile = await ProfileModel.get();
    const oldResume = existingProfile?.resume;

    let oldPublicId = oldResume?.publicId || existingProfile?.publicId || '';
    let oldResourceType =
      oldResume?.resourceType ||
      existingProfile?.resourceType ||
      (oldResume?.fileType === 'pdf' ? 'raw' : 'image');

    let cloudinaryDeleted = false;
    let cloudinaryNotice = null;

    if (!oldPublicId) {
      const oldUrlCandidate = oldResume?.fileUrl || existingProfile?.resumeUrl || '';
      const parsedOld = parseCloudinaryUrl(oldUrlCandidate);
      if (parsedOld) {
        oldPublicId = parsedOld.publicId;
        oldResourceType = parsedOld.resourceType;
      } else if (oldUrlCandidate) {
        cloudinaryNotice =
          'Resume record cleared in database. The previous resume link was not a Cloudinary URL, so no Cloudinary file was deleted.';
      }
    }

    if (oldPublicId) {
      const delRes = await deleteFromCloudinary(oldPublicId, oldResourceType);
      cloudinaryDeleted = Boolean(delRes.deleted);
    }

    const nowIso = new Date().toISOString();
    const updatedProfile = await ProfileModel.update({
      resumeUrl: '',
      resume: null,
      fileUrl: '',
      publicId: '',
      resourceType: '',
      fileType: '',
      originalName: '',
      authorUid: req.user?.username || 'admin',
      updatedAt: nowIso,
    });

    await recordAuditLog({
      req,
      action: 'DELETE',
      collectionName: 'profile',
      targetId: 'resume',
      targetTitle: `Official Resume (${oldResume?.originalName || 'Active Resume'})`,
      before: oldResume || { resumeUrl: existingProfile?.resumeUrl },
      after: null,
      modifiedFields: ['resumeUrl', 'resume'],
    });

    return res.json({
      success: true,
      cloudinaryDeleted,
      notice: cloudinaryNotice,
      data: updatedProfile,
      message: cloudinaryNotice || 'Resume removed from Cloudinary and cleared in MongoDB.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 7. Dynamic MongoDB Atlas Connection Test & Switch
// ==========================================

portfolioRouter.post('/mongo/connect', async (req, res) => {
  try {
    const { uri } = req.body || {};
    const result = await db.connectToRealMongo(uri ? String(uri).trim() : null);
    const health = await db.getHealth();
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        databaseName: result.databaseName || 'sachin_portfolio_db',
        isLiveAtlas: Boolean(result.isLiveAtlas),
        warning: result.warning || null,
        database: health,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.error || result.message,
        database: health,
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
