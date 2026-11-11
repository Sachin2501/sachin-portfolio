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
    recordAuditLog({
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
    // Capture existing project state before update for audit diff
    const existing = await ProjectModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Project not found in database.' });
    }

    const validation = validateProject({ ...existing, ...req.body }, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.errors.join(' '),
        details: validation.errors,
      });
    }

    const updates = {
      ...existing,
      ...req.body,
      ...validation.value,
      id: existing.id || req.params.id,
      _id: existing._id || req.params.id,
      updatedAt: new Date().toISOString(),
    };

    const updated = await ProjectModel.findByIdAndUpdate(req.params.id, updates);
    if (updated) {
      // Audit Log: Track who edited the project and what changed
      const modifiedFields = Object.keys(req.body || {});
      recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'projects',
        targetId: req.params.id,
        targetTitle: updated.title || existing.title,
        before: existing,
        after: updated,
        modifiedFields,
      });

      return res.json({
        success: true,
        message: `Project updated in MongoDB successfully.`,
        data: updated,
      });
    }

    return res.status(404).json({ success: false, error: 'Project not found in database.' });
  } catch (err) {
    console.error('[MongoDB PUT /projects/:id Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected: DELETE Project (Restricted to authenticated admin)
portfolioRouter.delete('/projects/:id', authenticateAdmin, async (req, res) => {
  try {
    // Capture project state before deletion for audit trail
    const existing = await ProjectModel.findById(req.params.id);
    const deleted = await ProjectModel.findByIdAndDelete(req.params.id);
    if (deleted) {
      // Audit Log: Track who deleted the project
      recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'projects',
        targetId: req.params.id,
        targetTitle: existing?.title || req.params.id,
        before: existing,
      });

      return res.json({
        success: true,
        message: 'Project deleted permanently from MongoDB database.',
      });
    }
    return res.status(404).json({ success: false, error: 'Project not found.' });
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
    res.json({ success: true, count: certs.length, data: certs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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

    recordAuditLog({
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
    const existing = await CertificationModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Certification not found' });
    }

    const validation = validateCertification({ ...existing, ...req.body }, true);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const updated = await CertificationModel.findByIdAndUpdate(req.params.id, {
      ...existing,
      ...req.body,
      ...validation.value,
      id: existing.id || req.params.id,
      _id: existing._id || req.params.id,
    });
    if (updated) {
      recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'certifications',
        targetId: req.params.id,
        targetTitle: `${updated.title || existing.title} (${updated.issuer || existing.issuer || 'Credential'})`,
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
    const existing = await CertificationModel.findById(req.params.id);
    const deleted = await CertificationModel.findByIdAndDelete(req.params.id);
    if (deleted) {
      recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'certifications',
        targetId: req.params.id,
        targetTitle: existing ? `${existing.title} (${existing.issuer || 'Credential'})` : req.params.id,
        before: existing,
      });
      return res.json({ success: true, message: 'Certification deleted from MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Certification not found' });
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

    recordAuditLog({
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
    const existing = await EducationModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Record not found' });
    }

    const validation = validateEducation({ ...existing, ...req.body }, true);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const updated = await EducationModel.findByIdAndUpdate(req.params.id, {
      ...existing,
      ...req.body,
      ...validation.value,
      id: existing.id || req.params.id,
      _id: existing._id || req.params.id,
    });
    if (updated) {
      recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'education',
        targetId: req.params.id,
        targetTitle: `${updated.degree || existing.degree} — ${updated.institution || existing.institution}`,
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
    const existing = await EducationModel.findById(req.params.id);
    const deleted = await EducationModel.findByIdAndDelete(req.params.id);
    if (deleted) {
      recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'education',
        targetId: req.params.id,
        targetTitle: existing ? `${existing.degree || existing.title} — ${existing.institution || existing.institute}` : req.params.id,
        before: existing,
      });
      return res.json({ success: true, message: 'Education record deleted from MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Record not found' });
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
    recordAuditLog({
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
    // Capture existing experience before update for audit diff
    const existing = await ExperienceModel.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Experience not found' });
    }

    const validation = validateExperience({ ...existing, ...req.body }, true);
    if (!validation.isValid) {
      return res.status(400).json({ success: false, error: validation.errors.join(' ') });
    }

    const updated = await ExperienceModel.findByIdAndUpdate(req.params.id, {
      ...existing,
      ...req.body,
      ...validation.value,
      id: existing.id || req.params.id,
      _id: existing._id || req.params.id,
    });
    if (updated) {
      // Audit Log: Track who updated the experience record
      const modifiedFields = Object.keys(req.body || {});
      recordAuditLog({
        req,
        action: 'UPDATE',
        collectionName: 'experience',
        targetId: req.params.id,
        targetTitle: `${updated.role || updated.title || existing.role} at ${updated.company || existing.company}`,
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
    // Capture existing experience before deletion for audit trail
    const existing = await ExperienceModel.findById(req.params.id);
    const deleted = await ExperienceModel.findByIdAndDelete(req.params.id);
    if (deleted) {
      // Audit Log: Track who deleted the experience record
      recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'experience',
        targetId: req.params.id,
        targetTitle: existing ? `${existing.role || existing.title} at ${existing.company}` : req.params.id,
        before: existing,
      });

      return res.json({ success: true, message: 'Experience deleted from MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Experience not found' });
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
    if (deleted) {
      await recordAuditLog({
        req,
        action: 'DELETE',
        collectionName: 'skills',
        targetId: rawId,
        targetTitle: existing ? `${existing.name} (${existing.domainTitle || existing.domainId || 'Skill'})` : rawId,
        before: existing,
      });
      return res.json({ success: true, message: 'Skill deleted from MongoDB' });
    }
    return res.status(404).json({ success: false, error: 'Skill not found' });
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
