import { db } from '../db/database.js';

export const ProjectModel = {
  find: (query = {}) => db.projects.find(query),
  findById: (id) => db.projects.findById(id),
  create: (doc) => db.projects.create(doc),
  findByIdAndUpdate: (id, updates) => db.projects.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.projects.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.projects.countDocuments(query),
};

export const CertificationModel = {
  find: (query = {}) => db.certifications.find(query),
  findById: (id) => db.certifications.findById(id),
  create: (doc) => db.certifications.create(doc),
  findByIdAndUpdate: (id, updates) => db.certifications.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.certifications.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.certifications.countDocuments(query),
};

export const EducationModel = {
  find: (query = {}) => db.education.find(query),
  findById: (id) => db.education.findById(id),
  create: (doc) => db.education.create(doc),
  findByIdAndUpdate: (id, updates) => db.education.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.education.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.education.countDocuments(query),
};

export const ExperienceModel = {
  find: (query = {}) => db.experience.find(query),
  findById: (id) => db.experience.findById(id),
  create: (doc) => db.experience.create(doc),
  findByIdAndUpdate: (id, updates) => db.experience.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.experience.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.experience.countDocuments(query),
};

export const SkillModel = {
  find: (query = {}) => db.skills.find(query),
  findById: (id) => db.skills.findById(id),
  create: (doc) => db.skills.create(doc),
  findByIdAndUpdate: (id, updates) => db.skills.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.skills.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.skills.countDocuments(query),
};

export const MessageModel = {
  find: (query = {}) => db.messages.find(query),
  findById: (id) => db.messages.findById(id),
  create: (doc) => db.messages.create(doc),
  findByIdAndUpdate: (id, updates) => db.messages.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.messages.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.messages.countDocuments(query),
};

export const ProfileModel = {
  get: async () => {
    const all = await db.profile.find();
    if (!Array.isArray(all) || all.length === 0) return null;
    // Prefer the canonical 'config' document, or the most recently updated document
    const configDocs = all.filter((p) => p.id === 'config' || String(p._id) === 'config');
    const pool = configDocs.length > 0 ? configDocs : all;
    const sorted = [...pool].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
    return sorted[0] || null;
  },
  update: async (updates) => {
    const all = await db.profile.find();
    const existing =
      all.find((p) => p.id === 'config' || String(p._id) === 'config') ||
      all[0] ||
      null;

    // Remove any duplicate non-config profile documents so get() is always deterministic
    if (Array.isArray(all) && all.length > 1) {
      for (const doc of all) {
        const docId = String(doc.id || doc._id || '');
        if (docId && docId !== 'config' && doc !== existing) {
          await db.profile.findByIdAndDelete(docId).catch(() => {});
        }
      }
    }

    const cleanUpdates = { ...updates };
    delete cleanUpdates._id;

    if (existing) {
      const targetId = existing.id || existing._id || 'config';
      const updated = await db.profile.findByIdAndUpdate(targetId, {
        ...existing,
        ...cleanUpdates,
        id: 'config',
        updatedAt: new Date().toISOString(),
      });
      if (updated) return updated;
    }
    return db.profile.create({
      ...(existing || {}),
      ...cleanUpdates,
      id: 'config',
      _id: 'config',
      updatedAt: new Date().toISOString(),
    });
  },
};

export const UserModel = {
  find: (query = {}) => db.users.find(query),
  findOne: (query) => db.users.findOne(query),
  findById: (id) => db.users.findById(id),
  create: (doc) => db.users.create(doc),
  findByIdAndUpdate: (id, updates) => db.users.findByIdAndUpdate(id, updates),
  findByIdAndDelete: (id) => db.users.findByIdAndDelete(id),
  countDocuments: (query = {}) => db.users.countDocuments(query),
};

export const AuditLogModel = {
  find: (query = {}) => db.auditLogs.find(query),
  findById: (id) => db.auditLogs.findById(id),
  create: (doc) => db.auditLogs.create(doc),
  countDocuments: (query = {}) => db.auditLogs.countDocuments(query),
  findByIdAndDelete: (id) => db.auditLogs.findByIdAndDelete(id),
  deleteMany: (query = {}) => db.auditLogs.deleteMany ? db.auditLogs.deleteMany(query) : null,
};

