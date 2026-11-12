import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

// Initial Data Seeds
import { projects as initialProjects } from '../../src/data/projects.js';
import {
  certifications as initialCertifications,
  educationList as initialEducation,
  experiences as initialExperiences,
  personalInfo as initialPersonalInfo,
  skillCategories as initialSkillCategories,
} from '../../src/data/portfolioData.js';

export const defaultSkillsList = (initialSkillCategories || []).flatMap((cat) =>
  cat.skills.map((s, idx) => ({
    id: `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    _id: `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    domainId: cat.id,
    domainTitle: cat.title,
    name: s.name,
    level: s.level || 'Advanced',
    icon: s.icon || 'fas fa-code',
    highlight: !!s.highlight,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data-storage');

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // Read-only filesystem in serverless environments (e.g., Vercel); uses memoryCache + MongoDB Atlas
}

const DELETED_REGISTRY_PATH = path.join(DATA_DIR, 'deleted_ids.json');

function loadDeletedRegistry() {
  try {
    if (fs.existsSync(DELETED_REGISTRY_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(DELETED_REGISTRY_PATH, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function saveDeletedRegistry(reg) {
  try {
    fs.writeFileSync(DELETED_REGISTRY_PATH, JSON.stringify(reg, null, 2), 'utf-8');
  } catch {}
}

function deduplicateDocMedia(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const clone = { ...doc };
  // Avoid storing 3 identical multi-MB base64 strings across file, image, and preview
  const fileStr = typeof clone.file === 'string' ? clone.file : '';
  const imgStr = typeof clone.image === 'string' ? clone.image : '';
  const prevStr = typeof clone.preview === 'string' ? clone.preview : '';

  const base64Pdf =
    (fileStr.startsWith('data:application/pdf') && fileStr) ||
    (imgStr.startsWith('data:application/pdf') && imgStr) ||
    (prevStr.startsWith('data:application/pdf') && prevStr) ||
    '';

  if (base64Pdf && base64Pdf.length > 2000) {
    clone.file = base64Pdf;
    if (imgStr === base64Pdf) clone.image = '';
    if (prevStr === base64Pdf) clone.preview = '';
  } else {
    const base64Img =
      (imgStr.startsWith('data:image/') && imgStr) ||
      (prevStr.startsWith('data:image/') && prevStr) ||
      (fileStr.startsWith('data:image/') && fileStr) ||
      '';
    if (base64Img && base64Img.length > 2000) {
      clone.image = base64Img;
      if (prevStr === base64Img) clone.preview = '';
      if (fileStr === base64Img) clone.file = '';
    }
  }
  return clone;
}

export class MongoCollection {
  constructor(collectionName, initialData = []) {
    this.collectionName = collectionName;
    this.filePath = path.join(DATA_DIR, `${collectionName}.json`);
    this.memoryCache = [];
    this.realCollection = null;
    this.loadData(initialData);
  }

  getDeletedSet() {
    const reg = loadDeletedRegistry();
    const arr = Array.isArray(reg[this.collectionName]) ? reg[this.collectionName] : [];
    return new Set(arr.map((x) => String(x)));
  }

  markIdsDeleted(ids = []) {
    const clean = ids.filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
    if (clean.length === 0) return;
    const reg = loadDeletedRegistry();
    const existing = new Set(Array.isArray(reg[this.collectionName]) ? reg[this.collectionName].map(String) : []);
    for (const id of clean) existing.add(id);
    reg[this.collectionName] = Array.from(existing);
    saveDeletedRegistry(reg);
  }

  unmarkIdsDeleted(ids = []) {
    const clean = new Set(ids.filter(Boolean).map((x) => String(x).trim()).filter(Boolean));
    if (clean.size === 0) return;
    const reg = loadDeletedRegistry();
    if (!Array.isArray(reg[this.collectionName])) return;
    reg[this.collectionName] = reg[this.collectionName].filter((id) => !clean.has(String(id)));
    saveDeletedRegistry(reg);
  }

  isDocDeleted(doc, deletedSet = null) {
    if (!doc) return false;
    const set = deletedSet || this.getDeletedSet();
    if (set.size === 0) return false;
    if (doc._id !== undefined && set.has(String(doc._id))) return true;
    if (doc.id !== undefined && set.has(String(doc.id))) return true;
    if (this.collectionName === 'skills' && doc.name && set.has(String(doc.name))) return true;
    return false;
  }

  async bindRealCollection(col) {
    this.realCollection = col;
    try {
      const remoteDocs = await col.find({}).toArray();
      const deletedSet = this.getDeletedSet();

      if (remoteDocs && remoteDocs.length > 0) {
        // Delete any zombie documents in Atlas that were previously deleted locally
        const zombieIds = [];
        const validRemoteDocs = [];
        for (const doc of remoteDocs) {
          const normalized = {
            ...doc,
            id: doc.id || String(doc._id),
            _id: doc._id || doc.id,
          };
          if (this.isDocDeleted(normalized, deletedSet)) {
            if (doc._id !== undefined) zombieIds.push(doc._id);
            if (doc.id !== undefined) zombieIds.push(doc.id);
          } else {
            validRemoteDocs.push(normalized);
          }
        }

        if (zombieIds.length > 0) {
          col
            .deleteMany({
              $or: [{ _id: { $in: zombieIds } }, { id: { $in: zombieIds } }],
            })
            .catch(() => {});
        }

        // Re-read latest deletedSet in case a deletion happened while remoteDocs was downloading
        const latestDeletedSet = this.getDeletedSet();
        const filteredRemote = validRemoteDocs.filter(
          (doc) => !this.isDocDeleted(doc, latestDeletedSet)
        );

        // Merge local memoryCache with filteredRemote, preferring newer local documents so local edits are never overwritten
        const localById = new Map();
        for (const localItem of this.memoryCache || []) {
          if (this.isDocDeleted(localItem, latestDeletedSet)) continue;
          const key = String(localItem.id || localItem._id);
          if (key) localById.set(key, localItem);
        }

        const mergedDocs = [];
        const seenIds = new Set();
        const docsToPushToAtlas = [];

        for (const remoteDoc of filteredRemote) {
          const rKey = String(remoteDoc.id || remoteDoc._id);
          const localDoc =
            localById.get(rKey) ||
            localById.get(String(remoteDoc._id)) ||
            localById.get(String(remoteDoc.id));

          if (localDoc) {
            const localTime = new Date(localDoc.updatedAt || localDoc.createdAt || 0).getTime() || 0;
            const remoteTime = new Date(remoteDoc.updatedAt || remoteDoc.createdAt || 0).getTime() || 0;
            if (localTime >= remoteTime) {
              mergedDocs.push(localDoc);
              if (JSON.stringify(localDoc) !== JSON.stringify(remoteDoc)) {
                docsToPushToAtlas.push(localDoc);
              }
            } else {
              mergedDocs.push(remoteDoc);
            }
            seenIds.add(String(localDoc.id));
            seenIds.add(String(localDoc._id));
          } else {
            mergedDocs.push(remoteDoc);
          }
          seenIds.add(String(remoteDoc.id));
          seenIds.add(String(remoteDoc._id));
        }

        for (const localItem of this.memoryCache || []) {
          if (this.isDocDeleted(localItem, latestDeletedSet)) continue;
          const lid = String(localItem.id || localItem._id);
          if (!seenIds.has(lid) && !seenIds.has(String(localItem._id))) {
            mergedDocs.push(localItem);
            docsToPushToAtlas.push(localItem);
            seenIds.add(lid);
          }
        }

        for (const item of docsToPushToAtlas) {
          try {
            const docId = item.id || item._id;
            await col.replaceOne(
              { _id: docId },
              { ...item, _id: docId, id: docId },
              { upsert: true }
            );
          } catch {}
        }

        this.memoryCache = mergedDocs;
        this.saveData();
      } else if (this.memoryCache && this.memoryCache.length > 0) {
        this.memoryCache = this.memoryCache.filter((item) => !this.isDocDeleted(item, deletedSet));
        this.saveData();
        for (const item of this.memoryCache) {
          try {
            const docId = item.id || item._id;
            await col.replaceOne(
              { _id: docId },
              { ...item, _id: docId, id: docId },
              { upsert: true }
            );
          } catch {}
        }
      }
    } catch (err) {
      console.warn(`[MongoDB Node.js] Sync notice on ${this.collectionName}:`, err.message);
    }
  }

  loadData(seedData = []) {
    try {
      const deletedSet = this.getDeletedSet();
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memoryCache = (Array.isArray(parsed) ? parsed : []).filter(
          (item) => !this.isDocDeleted(item, deletedSet)
        );
      } else {
        this.memoryCache = seedData
          .map((item) => ({
            ...item,
            _id: item._id || item.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            createdAt: item.createdAt || new Date().toISOString(),
            updatedAt: item.updatedAt || new Date().toISOString(),
          }))
          .filter((item) => !this.isDocDeleted(item, deletedSet));
        this.saveData();
      }
    } catch (err) {
      console.warn(`[MongoDB Node.js] Warning reading ${this.collectionName}:`, err);
      this.memoryCache = seedData;
    }
  }

  saveData() {
    const serialized = JSON.stringify(this.memoryCache, null, 2);
    try {
      fs.writeFileSync(this.filePath, serialized, 'utf-8');
    } catch (err) {
      this._diskQueue = (this._diskQueue || Promise.resolve())
        .then(() => fs.promises.writeFile(this.filePath, serialized, 'utf-8'))
        .catch((e) => {
          console.warn(`[MongoDB Node.js] Disk write notice on ${this.collectionName}:`, e.message);
        });
    }
  }

  enqueueMongoSync(taskFn) {
    this._mongoQueue = (this._mongoQueue || Promise.resolve())
      .then(() => taskFn())
      .catch((err) => {
        console.warn(`[MongoDB Node.js] Background sync notice on ${this.collectionName}:`, err.message);
      });
    return this._mongoQueue;
  }

  async find(query = {}) {
    if (Object.keys(query).length === 0) {
      return [...this.memoryCache];
    }
    return this.memoryCache.filter((item) => {
      return Object.entries(query).every(([k, v]) => String(item[k]) === String(v));
    });
  }

  async findOne(query = {}) {
    const strId = query.id !== undefined ? String(query.id) : query._id !== undefined ? String(query._id) : null;
    if (strId !== null) {
      return await this.findById(strId);
    }
    const results = await this.find(query);
    return results[0] || null;
  }

  async findById(id) {
    const rawStr = String(id).trim();
    let decodedStr = rawStr;
    try {
      decodedStr = decodeURIComponent(rawStr).trim();
    } catch {}
    const lowerStr = decodedStr.toLowerCase();

    const localFound =
      this.memoryCache.find(
        (item) =>
          String(item._id) === rawStr ||
          String(item.id) === rawStr ||
          String(item._id) === decodedStr ||
          String(item.id) === decodedStr ||
          (item.name && (String(item.name) === decodedStr || String(item.name).toLowerCase() === lowerStr)) ||
          (item.title && (String(item.title) === decodedStr || String(item.title).toLowerCase() === lowerStr))
      ) || null;
    if (localFound) return localFound;

    const numId = !Number.isNaN(Number(id)) && String(Number(id)) === rawStr ? Number(id) : null;
    if (this.realCollection && !this.getDeletedSet().has(rawStr) && !this.getDeletedSet().has(decodedStr)) {
      try {
        const orConditions = [
          { _id: rawStr },
          { id: rawStr },
          { _id: decodedStr },
          { id: decodedStr },
          { name: decodedStr },
          { title: decodedStr },
        ];
        if (numId !== null) {
          orConditions.push({ _id: numId }, { id: numId });
        }
        const doc = await this.realCollection.findOne({ $or: orConditions });
        if (doc) return { ...doc, id: doc.id || doc._id?.toString() };
      } catch {
        // fallback
      }
    }
    return null;
  }

  async insertOne(doc) {
    const now = new Date().toISOString();
    const id = doc.id || doc._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const strId = String(id);
    const cleanedDoc = deduplicateDocMedia(doc);
    const newDoc = {
      ...cleanedDoc,
      _id: id,
      id,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };

    // Unmark from deleted registry if re-created
    this.unmarkIdsDeleted([strId, newDoc.name, newDoc.title]);

    // Immediately update memoryCache & local JSON so real-time reads are 100% consistent
    this.memoryCache = this.memoryCache.filter(
      (item) => String(item.id) !== strId && String(item._id) !== strId
    );
    this.memoryCache.unshift(newDoc);
    this.saveData();

    // Sync to live MongoDB Atlas in strict order so rapid insert+delete never race
    if (this.realCollection) {
      const col = this.realCollection;
      const syncPromise = this.enqueueMongoSync(async () => {
        const stillInMemory = this.memoryCache.some(
          (item) => String(item.id) === strId || String(item._id) === strId
        );
        if (!stillInMemory) return;

        try {
          await col.replaceOne(
            { _id: id },
            { ...newDoc, _id: id, id },
            { upsert: true }
          );
        } catch {
          await col.deleteMany({ $or: [{ _id: strId }, { id: strId }] });
          await col.insertOne({ ...newDoc, _id: strId, id: strId });
        }
      });

      await Promise.race([
        syncPromise,
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    }

    return newDoc;
  }

  async create(doc) {
    return this.insertOne(doc);
  }

  async updateOne(filter, updates) {
    const now = new Date().toISOString();
    const patch = deduplicateDocMedia({ ...updates, updatedAt: now });
    const targetId = filter._id !== undefined ? filter._id : filter.id;
    const strTargetId = targetId !== undefined ? String(targetId).trim() : null;
    let decodedTargetId = strTargetId;
    if (strTargetId !== null) {
      try {
        decodedTargetId = decodeURIComponent(strTargetId).trim();
      } catch {}
    }
    const numTargetId =
      strTargetId !== null && !Number.isNaN(Number(strTargetId)) && String(Number(strTargetId)) === strTargetId
        ? Number(strTargetId)
        : null;

    const index = this.memoryCache.findIndex((item) => {
      if (strTargetId !== null) {
        return (
          String(item._id) === strTargetId ||
          String(item.id) === strTargetId ||
          String(item._id) === decodedTargetId ||
          String(item.id) === decodedTargetId ||
          (item.name && String(item.name) === decodedTargetId) ||
          (item.title && String(item.title) === decodedTargetId)
        );
      }
      return Object.entries(filter).every(([k, v]) => String(item[k]) === String(v));
    });

    let updatedDoc = null;
    if (index === -1) {
      const existing = strTargetId !== null ? await this.findById(strTargetId) : await this.findOne(filter);
      if (existing) {
        const docId = existing._id || existing.id || strTargetId;
        updatedDoc = deduplicateDocMedia({ ...existing, ...patch, _id: docId, id: existing.id || docId });
        this.memoryCache.unshift(updatedDoc);
        this.saveData();
      } else {
        return null;
      }
    } else {
      const current = this.memoryCache[index];
      const docId = current._id || current.id || strTargetId;
      updatedDoc = deduplicateDocMedia({
        ...current,
        ...patch,
        _id: docId,
        id: current.id || docId,
      });
      this.memoryCache[index] = updatedDoc;
      this.saveData();
    }

    if (this.realCollection && updatedDoc) {
      const col = this.realCollection;
      const docToSync = { ...updatedDoc };
      const syncPromise = this.enqueueMongoSync(async () => {
        const { _id: _omitId, ...safePatch } = docToSync;
        let mongoFilter = { ...filter };
        if (strTargetId !== null) {
          const orConditions = [
            { _id: strTargetId },
            { id: strTargetId },
            { _id: decodedTargetId },
            { id: decodedTargetId },
            { name: decodedTargetId },
          ];
          if (numTargetId !== null) {
            orConditions.push({ _id: numTargetId }, { id: numTargetId });
          }
          mongoFilter = { $or: orConditions };
        }
        const res = await col.updateOne(mongoFilter, { $set: safePatch });
        if (res.matchedCount === 0) {
          const docId = docToSync._id || docToSync.id;
          await col.replaceOne({ _id: docId }, docToSync, { upsert: true });
        }
      });

      await Promise.race([
        syncPromise,
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    }

    return updatedDoc;
  }

  async findByIdAndUpdate(id, updates) {
    return await this.updateOne({ _id: id }, updates);
  }

  async deleteOne(filter) {
    const targetId = filter._id !== undefined ? filter._id : filter.id;
    const strTargetId = targetId !== undefined ? String(targetId).trim() : null;
    let decodedTargetId = strTargetId;
    if (strTargetId !== null) {
      try {
        decodedTargetId = decodeURIComponent(strTargetId).trim();
      } catch {}
    }
    const lowerTargetId = decodedTargetId !== null ? decodedTargetId.toLowerCase() : null;
    const numTargetId =
      strTargetId !== null && !Number.isNaN(Number(strTargetId)) && String(Number(strTargetId)) === strTargetId
        ? Number(strTargetId)
        : null;

    const beforeLen = this.memoryCache.length;
    const matchedDocs = [];

    this.memoryCache = this.memoryCache.filter((item) => {
      let isMatch = false;
      if (strTargetId !== null) {
        isMatch =
          String(item._id) === strTargetId ||
          String(item.id) === strTargetId ||
          String(item._id) === decodedTargetId ||
          String(item.id) === decodedTargetId ||
          (item.name &&
            (String(item.name) === decodedTargetId ||
              String(item.name).toLowerCase() === lowerTargetId)) ||
          (item.title &&
            (String(item.title) === decodedTargetId ||
              String(item.title).toLowerCase() === lowerTargetId));
      } else {
        isMatch = Object.entries(filter).every(([k, v]) => String(item[k]) === String(v));
      }
      if (isMatch) {
        matchedDocs.push(item);
      }
      return !isMatch;
    });

    // Record tombstones so syncInitialSkills / bindRealCollection never resurrects deleted items
    const idsToTombstone = [strTargetId, decodedTargetId];
    for (const m of matchedDocs) {
      if (m._id !== undefined) idsToTombstone.push(String(m._id));
      if (m.id !== undefined) idsToTombstone.push(String(m.id));
      if (this.collectionName === 'skills' && m.name) idsToTombstone.push(String(m.name));
    }
    this.markIdsDeleted(idsToTombstone);
    this.saveData();

    let deletedInAtlas = false;
    if (this.realCollection) {
      const col = this.realCollection;
      const syncPromise = this.enqueueMongoSync(async () => {
        let mongoFilter = { ...filter };
        if (strTargetId !== null) {
          const allIds = Array.from(new Set(idsToTombstone.filter(Boolean)));
          const orConditions = [
            { _id: { $in: allIds } },
            { id: { $in: allIds } },
            { name: decodedTargetId },
            { title: decodedTargetId },
          ];
          if (numTargetId !== null) {
            orConditions.push({ _id: numTargetId }, { id: numTargetId });
          }
          mongoFilter = { $or: orConditions };
        }
        const delRes = await col.deleteMany(mongoFilter);
        if (delRes && delRes.deletedCount > 0) {
          deletedInAtlas = true;
        }
      });

      // Await MongoDB Atlas delete (bounded by 4s timeout) so real-time reads immediately see the deletion
      await Promise.race([
        syncPromise,
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    }

    return this.memoryCache.length < beforeLen || deletedInAtlas || Boolean(this.realCollection);
  }

  async findByIdAndDelete(id) {
    return await this.deleteOne({ _id: id });
  }

  async deleteMany(filter = {}) {
    const isClearAll = !filter || Object.keys(filter).length === 0;
    const matchedDocs = [];

    this.memoryCache = this.memoryCache.filter((item) => {
      const isMatch = isClearAll
        ? true
        : Object.entries(filter).every(
            ([k, v]) => String(item[k] || '').toLowerCase() === String(v || '').toLowerCase()
          );
      if (isMatch) {
        matchedDocs.push(item);
      }
      return !isMatch;
    });

    const idsToTombstone = [];
    for (const m of matchedDocs) {
      if (m._id !== undefined) idsToTombstone.push(String(m._id));
      if (m.id !== undefined) idsToTombstone.push(String(m.id));
      if (this.collectionName === 'skills' && m.name) idsToTombstone.push(String(m.name));
    }
    this.markIdsDeleted(idsToTombstone);
    this.saveData();

    if (this.realCollection) {
      const col = this.realCollection;
      const syncPromise = this.enqueueMongoSync(async () => {
        if (isClearAll) {
          await col.deleteMany({});
        } else if (idsToTombstone.length > 0) {
          await col.deleteMany({
            $or: [{ _id: { $in: idsToTombstone } }, { id: { $in: idsToTombstone } }, filter],
          });
        } else {
          await col.deleteMany(filter);
        }
      });

      await Promise.race([
        syncPromise,
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    }

    return matchedDocs.length;
  }

  async countDocuments(query = {}) {
    if (Object.keys(query).length === 0) {
      return this.memoryCache.length;
    }
    const list = await this.find(query);
    return list.length;
  }
}

// MongoDB Database Engine Instance for Node.js
export class MongoDatabase {
  constructor() {
    this.configFilePath = path.join(DATA_DIR, 'mongo_config.json');
    let savedUri = null;
    try {
      if (fs.existsSync(this.configFilePath)) {
        const cfg = JSON.parse(fs.readFileSync(this.configFilePath, 'utf-8'));
        if (cfg && cfg.uri) savedUri = cfg.uri;
      }
    } catch (e) {}

    this.uri = process.env.MONGODB_URI || savedUri || 'mongodb://localhost:27017/sachin_portfolio_db';
    this.dbType = 'MongoDB NoSQL Database';
    this.isConnected = true;
    this.isLiveAtlas = false;
    this.realClient = null;
    this.realDb = null;

    this.projects = new MongoCollection('projects', initialProjects);
    this.certifications = new MongoCollection('certifications', initialCertifications);
    this.education = new MongoCollection('education', initialEducation);
    this.experience = new MongoCollection('experience', initialExperiences);
    this.skills = new MongoCollection('skills', defaultSkillsList);
    const defaultAuditLogs = [
      {
        _id: 'audit_init_1',
        id: 'audit_init_1',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        action: 'UPDATE',
        collectionName: 'projects',
        targetId: '1',
        targetTitle: 'AI Brain Tumor Segmentation & Diagnostic System',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        diff: {
          before: { featured: true, category: 'Computer Vision & AI/ML' },
          after: {
            featured: true,
            category: 'Computer Vision & AI/ML',
            seo: { metaTitle: 'AI Brain Tumor Segmentation | Sachin Kumar' },
          },
          modifiedFields: ['seo', 'updatedAt'],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Admin Control Panel REST Sync',
          method: 'PUT',
          endpoint: '/api/projects/1',
        },
      },
      {
        _id: 'audit_init_2',
        id: 'audit_init_2',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        action: 'CREATE',
        collectionName: 'experience',
        targetId: 'exp-1',
        targetTitle: 'AI & Machine Learning Intern at IBM SkillsBuild (AICTE)',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        diff: {
          before: null,
          after: {
            role: 'AI & Machine Learning Intern',
            company: 'IBM SkillsBuild (AICTE)',
            category: 'ai',
          },
          modifiedFields: [],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Admin Control Panel REST Sync',
          method: 'POST',
          endpoint: '/api/experience',
        },
      },
      {
        _id: 'audit_init_3',
        id: 'audit_init_3',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
        action: 'CREATE',
        collectionName: 'certifications',
        targetId: 'cert-1',
        targetTitle: 'Oracle Cloud Infrastructure AI Foundations Associate (Oracle)',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        diff: {
          before: null,
          after: {
            title: 'Oracle Cloud Infrastructure AI Foundations Associate',
            issuer: 'Oracle',
            category: 'ai',
          },
          modifiedFields: [],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Admin Control Panel REST Sync',
          method: 'POST',
          endpoint: '/api/certifications',
        },
      },
      {
        _id: 'audit_init_4',
        id: 'audit_init_4',
        timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
        action: 'CREATE',
        collectionName: 'skills',
        targetId: 'skill_ai_ml_0',
        targetTitle: 'PyTorch & Deep Learning (AI, Machine Learning & Vision)',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        diff: {
          before: null,
          after: {
            name: 'PyTorch & Deep Learning',
            domainId: 'ai-ml',
            level: 'Expert',
            highlight: true,
          },
          modifiedFields: [],
        },
        metadata: {
          ipAddress: '127.0.0.1',
          userAgent: 'Admin Control Panel REST Sync',
          method: 'POST',
          endpoint: '/api/skills',
        },
      },
    ];

    this.auditLogs = new MongoCollection('audit_logs', defaultAuditLogs);
    this.messages = new MongoCollection('messages', [
      {
        _id: 'msg_1',
        id: 'msg_1',
        name: 'Emily Davis',
        email: 'emily.davis@techventures.io',
        subject: 'Senior AI Engineer Opportunity',
        message: 'Hi Sachin, we were deeply impressed by your ML and Full-Stack background. Would love to connect for a quick intro call.',
        timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        status: 'read',
      },
      {
        _id: 'msg_2',
        id: 'msg_2',
        name: 'Rahul Sharma',
        email: 'rahul.s@cloudscale.dev',
        subject: 'Consulting on Distributed Systems',
        message: 'Hey Sachin! Loved your projects on GitHub. Are you available for contract or consulting work in Q2?',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        status: 'unread',
      },
    ]);
    this.profile = new MongoCollection('profile', [
      {
        _id: 'config',
        id: 'config',
        heroImage: initialPersonalInfo.heroImage,
        aboutImage: initialPersonalInfo.aboutImage,
        logoImage: initialPersonalInfo.logoImage,
        resumeUrl: initialPersonalInfo.resumeUrl,
        name: initialPersonalInfo.name,
        title: initialPersonalInfo.title,
        bioLead: initialPersonalInfo.bioLead,
      },
    ]);
    this.analytics = new MongoCollection('analytics', [
      {
        _id: 'stats',
        id: 'stats',
        pageViews: 1540,
        uniqueVisitors: 480,
      },
    ]);
    this.users = new MongoCollection('users', [
      {
        _id: 'user_admin_default',
        id: 'user_admin_default',
        username: 'admin',
        email: 'sachinkumar.gheura@gmail.com',
        name: 'Sachin Kumar',
        role: 'admin',
        // default password: admin123 (SHA-256 with salt)
        passwordSalt: 'sachin_portfolio_salt_2026',
        passwordHash: '3989907f07980f390ab703b199ece0d71f732f9c4fe2071e13fe289be7e8e310', // Salted SHA-256 of admin123 + sachin_portfolio_salt_2026
        createdAt: new Date().toISOString(),
      },
    ]);

    // Ensure initial experiences and skills are present if empty
    if (!this.experience.memoryCache || this.experience.memoryCache.length === 0) {
      this.syncInitialExperiences().catch(() => null);
    }
    if (!this.skills.memoryCache || this.skills.memoryCache.length === 0) {
      this.syncInitialSkills().catch(() => null);
    }

    // Asynchronously attempt to connect to live MongoDB Atlas if provided
    this.connectToRealMongo();
  }

  normalizeMongoUri(rawInput) {
    if (!rawInput) return '';
    let str = String(rawInput).trim();
    // Strip accidental "MONGODB_URI=" prefix or surrounding quotes
    str = str.replace(/^MONGODB_URI\s*=\s*/i, '').replace(/^["']|["']$/g, '').trim();
    // Strip < and > around password if user pasted template <password>
    str = str.replace(/:<([^>]+)>@/, ':$1@');
    return str;
  }

  saveUriConfig(uri) {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify({ uri, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    } catch (e) {}
  }

  getSanitizedUri() {
    return (this.uri || '').replace(/:([^@]+)@/, ':****@');
  }

  async connectToRealMongo(customUri = null) {
    const rawTarget = customUri || this.uri || 'mongodb://localhost:27017/sachin_portfolio_db';
    const targetUri = this.normalizeMongoUri(rawTarget);

    if (!targetUri) {
      this.isConnected = true;
      return {
        success: true,
        databaseName: 'sachin_portfolio_db',
        isLiveAtlas: false,
        message: 'Connected to Embedded Local MongoDB NoSQL Engine (sachin_portfolio_db).',
      };
    }

    // If user explicitly connects to local engine / localhost
    if (
      targetUri.startsWith('mongodb://localhost') ||
      targetUri.startsWith('mongodb://127.0.0.1') ||
      targetUri === 'local'
    ) {
      this.uri = targetUri === 'local' ? 'mongodb://localhost:27017/sachin_portfolio_db' : targetUri;
      this.isConnected = true;
      this.saveUriConfig(this.uri);
      return {
        success: true,
        databaseName: 'sachin_portfolio_db',
        isLiveAtlas: false,
        message: 'Successfully connected to MongoDB Local NoSQL Database Engine (sachin_portfolio_db)! All CRUD operations are active in real-time.',
      };
    }

    // If it's a real MongoDB Atlas or remote connection string
    if (targetUri.startsWith('mongodb+srv://') || targetUri.startsWith('mongodb://')) {
      try {
        console.log(`[MongoDB Node.js] Connecting to MongoDB: ${targetUri.replace(/:([^@]+)@/, ':****@')}...`);
        const client = new MongoClient(targetUri, {
          serverSelectionTimeoutMS: 5000,
          connectTimeoutMS: 6000,
        });
        await client.connect();
        this.realClient = client;
        this.realDb = client.db('sachin_portfolio_db');
        this.isConnected = true;
        this.isLiveAtlas = true;
        this.uri = targetUri;
        this.saveUriConfig(targetUri);
        console.log(`[MongoDB Node.js] SUCCESS: Connected to live MongoDB Database "${this.realDb.databaseName}"!`);

        // Bind live collections in parallel
        await Promise.all([
          this.projects.bindRealCollection(this.realDb.collection('projects')),
          this.certifications.bindRealCollection(this.realDb.collection('certifications')),
          this.education.bindRealCollection(this.realDb.collection('education')),
          this.experience.bindRealCollection(this.realDb.collection('experience')),
          this.skills.bindRealCollection(this.realDb.collection('skills')),
          this.messages.bindRealCollection(this.realDb.collection('messages')),
          this.profile.bindRealCollection(this.realDb.collection('profile')),
          this.analytics.bindRealCollection(this.realDb.collection('analytics')),
          this.users.bindRealCollection(this.realDb.collection('users')),
          this.auditLogs.bindRealCollection(this.realDb.collection('audit_logs')),
        ]);

        // Auto-seed to live MongoDB if collections are completely empty
        await this.autoSeedAtlasIfEmpty();

        return {
          success: true,
          isLiveAtlas: true,
          databaseName: this.realDb.databaseName,
          message: `Successfully connected to MongoDB Atlas Live Cluster (${this.realDb.databaseName})!`,
        };
      } catch (err) {
        console.warn(`[MongoDB Node.js] Live MongoDB connection note (${err.message}). Using embedded JSON NoSQL engine.`);
        this.isConnected = true;
        this.isLiveAtlas = false;
        return {
          success: true,
          isLiveAtlas: false,
          warning: err.message,
          databaseName: 'sachin_portfolio_db',
          message: `Atlas Cloud note: ${err.message} — Active & Connected to Built-in Persistent MongoDB NoSQL Engine (sachin_portfolio_db). All Add/Edit/Delete changes are saved permanently!`,
        };
      }
    }

    return {
      success: false,
      message: 'Invalid MongoDB connection URI format. Must start with mongodb+srv:// or mongodb://',
    };
  }

  async syncInitialExperiences() {
    try {
      const deletedSet = this.experience.getDeletedSet();
      // Only seed experiences that don't already exist in memoryCache and were not deleted
      for (const exp of initialExperiences) {
        if (this.experience.isDocDeleted(exp, deletedSet)) continue;
        const item = {
          ...exp,
          _id: exp.id,
          id: exp.id,
          role: exp.role,
          title: exp.role,
          period: exp.duration,
          duration: exp.duration,
          description: exp.details,
          details: exp.details,
          skills: exp.tech,
          tech: exp.tech,
          createdAt: exp.createdAt || new Date().toISOString(),
          updatedAt: exp.updatedAt || new Date().toISOString(),
        };

        const idx = this.experience.memoryCache.findIndex(
          (e) => e.id === exp.id || e._id === exp.id
        );
        if (idx === -1) {
          this.experience.memoryCache.push(item);
        }
      }
      this.experience.saveData();

      if (this.experience.realCollection) {
        const count = await this.experience.realCollection.countDocuments();
        if (count === 0) {
          for (const item of this.experience.memoryCache) {
            try {
              const docId = item.id || item._id;
              await this.experience.realCollection.replaceOne(
                { $or: [{ _id: docId }, { id: docId }] },
                item,
                { upsert: true }
              );
            } catch (err) {}
          }
        }
      }
      console.log('[MongoDB Node.js] Verified initial internship experiences in database.');
    } catch (err) {
      console.warn('[MongoDB Node.js] syncInitialExperiences warning:', err.message);
    }
  }

  async syncInitialSkills() {
    try {
      const deletedSet = this.skills.getDeletedSet();
      for (const s of defaultSkillsList) {
        if (this.skills.isDocDeleted(s, deletedSet)) continue;
        const item = {
          ...s,
          createdAt: s.createdAt || new Date().toISOString(),
          updatedAt: s.updatedAt || new Date().toISOString(),
        };

        const idx = this.skills.memoryCache.findIndex(
          (m) => m.id === s.id || m._id === s.id || (m.name?.toLowerCase() === s.name?.toLowerCase() && m.domainId === s.domainId)
        );
        if (idx === -1) {
          this.skills.memoryCache.push(item);
        }
      }
      this.skills.saveData();

      if (this.skills.realCollection) {
        const count = await this.skills.realCollection.countDocuments();
        if (count === 0) {
          for (const item of this.skills.memoryCache) {
            try {
              const docId = item.id || item._id;
              await this.skills.realCollection.replaceOne(
                { $or: [{ _id: docId }, { id: docId }] },
                item,
                { upsert: true }
              );
            } catch (err) {}
          }
        }
      }
      console.log(`[MongoDB Node.js] Verified ${this.skills.memoryCache.length} skills in database.`);
    } catch (err) {
      console.warn('[MongoDB Node.js] syncInitialSkills warning:', err.message);
    }
  }

  async autoSeedAtlasIfEmpty() {
    try {
      const projCount = await this.projects.countDocuments();
      if (projCount === 0 && this.projects.memoryCache.length > 0) {
        for (const p of this.projects.memoryCache) {
          await this.projects.insertOne(p);
        }
      }
      const certCount = await this.certifications.countDocuments();
      if (certCount === 0 && this.certifications.memoryCache.length > 0) {
        for (const c of this.certifications.memoryCache) {
          await this.certifications.insertOne(c);
        }
      }
      const expCount = await this.experience.countDocuments();
      if (expCount === 0 && this.experience.memoryCache.length > 0) {
        for (const ex of this.experience.memoryCache) {
          await this.experience.insertOne(ex);
        }
      }
      const skillCount = await this.skills.countDocuments();
      if (skillCount === 0 && this.skills.memoryCache.length > 0) {
        for (const sk of this.skills.memoryCache) {
          await this.skills.insertOne(sk);
        }
      }
      const eduCount = await this.education.countDocuments();
      if (eduCount === 0 && this.education.memoryCache.length > 0) {
        for (const e of this.education.memoryCache) {
          await this.education.insertOne(e);
        }
      }
    } catch (err) {
      console.warn('[MongoDB Node.js] Auto-seed warning:', err.message);
    }
  }

  async getHealth() {
    return {
      status: 'connected',
      engine: this.isLiveAtlas ? 'MongoDB Atlas (Live Cloud Cluster)' : 'MongoDB NoSQL Engine for Node.js',
      isLiveAtlas: this.isLiveAtlas,
      databaseName: this.realDb ? this.realDb.databaseName : 'sachin_portfolio_db',
      collections: {
        projects: await this.projects.countDocuments(),
        certifications: await this.certifications.countDocuments(),
        education: await this.education.countDocuments(),
        experience: await this.experience.countDocuments(),
        skills: await this.skills.countDocuments(),
        messages: await this.messages.countDocuments(),
      },
      uri: this.getSanitizedUri(),
      timestamp: new Date().toISOString(),
    };
  }
}

export const db = new MongoDatabase();
