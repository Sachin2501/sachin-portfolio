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
    const doc = await db.profile.findOne({ id: 'config' });
    return doc || (await db.profile.find())[0] || null;
  },
  update: async (updates) => {
    const existing = await db.profile.findOne({ id: 'config' });
    if (existing) {
      return db.profile.updateOne({ id: 'config' }, updates);
    }
    return db.profile.create({ id: 'config', ...updates });
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

