import { Router } from 'express';
import {
  ProjectModel,
  CertificationModel,
  EducationModel,
  ExperienceModel,
  SkillModel,
  ProfileModel,
} from '../models/index.js';
import { db } from '../db/database.js';
import { authenticateAdmin } from '../middleware/auth.js';
import {
  validateProject,
  validateCertification,
  validateEducation,
  validateExperience,
  validateSkill,
} from '../models/validators.js';
import { recordAuditLog } from '../services/auditLogger.js';

export const portfolioRouter = Router();

// ==========================================
// 0. AGGREGATED PORTFOLIO PAYLOAD (GET /api/portfolio)
// ==========================================

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
  return clone;
}

portfolioRouter.get('/portfolio', async (_req, res) => {
  try {
    let [projects, certifications, education, experience, skills, profile, messagesCount, dbHealth] =
      await Promise.all([
        ProjectModel.find(),
        CertificationModel.find(),
        EducationModel.find(),
        ExperienceModel.find(),
        SkillModel.find(),
        ProfileModel.get(),
        db.messages.countDocuments(),
        db.getHealth(),
      ]);

    const cleanExperience = (experience || []).filter((e) => e.role !== 'Senior Full Stack Engineer');
    const wireCertifications = (certifications || []).map(optimizeCertForWire);

    res.json({
      success: true,
      status: 'healthy',
      endpoint: '/api/portfolio',
      runtime: 'Node.js ' + process.version,
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbHealth,
      counts: {
        projects: (projects || []).length,
        certifications: wireCertifications.length,
        education: (education || []).length,
        experience: cleanExperience.length,
        skills: (skills || []).length,
        messages: messagesCount || 0,
      },
      data: {
        profile: profile || {},
        projects: projects || [],
        experience: cleanExperience,
        skills: skills || [],
        certifications: wireCertifications,
        education: education || [],
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
    let existing = await ProjectModel.findById(rawId);

    // Fallback: match by title if ID format changed between seed and Atlas
    if (!existing && req.body?.title) {
      const allProjects = await ProjectModel.find();
      existing =
        allProjects.find(
          (p) =>
            String(p.title || '').toLowerCase() ===
            String(req.body.title || '').toLowerCase()
        ) || null;
    }

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
    if (typeof rawMedia === 'string' && rawMedia.startsWith('http')) {
      return res.redirect(rawMedia);
    }
    return res.status(404).send('Certificate file not available');
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

portfolioRouter.post('/certifications', authenticateAdmin, async (req, res) => {
  try {
    const validation = validateCertification(req.body, false);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const certId = req.body.id || `cert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newCert = await CertificationModel.create({
      ...req.body,
      ...validation.value,
      id: certId,
      authorUid: req.user?.username || 'admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await recordAuditLog({
      req,
      action: 'CREATE',
      collectionName: 'certifications',
      targetId: newCert.id || newCert._id,
      targetTitle: `${newCert.title} (${newCert.issuer || 'Credential'})`,
      after: newCert,
    });

    res.status(201).json({
      success: true,
      message: `Certification "${newCert.title}" saved to MongoDB!`,
      data: newCert,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.put('/certifications/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    let existing = await CertificationModel.findById(rawId);
    if (!existing && req.body?.title) {
      const allCerts = await CertificationModel.find();
      existing =
        allCerts.find(
          (c) => String(c.title || '').toLowerCase() === String(req.body.title || '').toLowerCase()
        ) || null;
    }

    const mergedCandidate = {
      title: existing?.title || req.body?.title || 'Professional Certification',
      issuer: existing?.issuer || req.body?.issuer || 'Credential Authority',
      ...(existing || {}),
      ...(req.body || {}),
    };

    const validation = validateCertification(mergedCandidate, true);
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

    let updated = await CertificationModel.findByIdAndUpdate(targetId, payload);
    if (!updated) {
      updated = await CertificationModel.create({
        ...payload,
        createdAt: existing?.createdAt || new Date().toISOString(),
      });
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
        modifiedFields: Object.keys(req.body || {}),
      });
      return res.json({ success: true, data: updated, message: 'Certification updated in MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Certification not found' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

portfolioRouter.delete('/certifications/:id', authenticateAdmin, async (req, res) => {
  try {
    const rawId = decodeURIComponent(req.params.id || '').trim();
    const existing = await CertificationModel.findById(rawId);
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
    return res.json({ success: true, message: 'Certification deleted from MongoDB' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    let existing = await EducationModel.findById(rawId);
    if (!existing && (req.body?.degree || req.body?.title)) {
      const allEdu = await EducationModel.find();
      const targetDeg = String(req.body.degree || req.body.title || '').toLowerCase();
      existing =
        allEdu.find(
          (e) => String(e.degree || e.title || '').toLowerCase() === targetDeg
        ) || null;
    }

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
    let existing = await ExperienceModel.findById(rawId);
    if (!existing && (req.body?.role || req.body?.title)) {
      const allExp = await ExperienceModel.find();
      const targetRole = String(req.body.role || req.body.title || '').toLowerCase();
      existing =
        allExp.find(
          (e) => String(e.role || e.title || '').toLowerCase() === targetRole
        ) || null;
    }

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
