import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId } from 'mongodb';

export const realtimeBus = new EventEmitter();
realtimeBus.setMaxListeners(100);

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
    id: s.id || `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    _id: s._id || s.id || `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
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

function withTimeout(promise, ms = 4000) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('MongoDB operation timeout')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toSafeObjectId(val) {
  if (!val) return null;
  const str = String(val).trim();
  if (/^[0-9a-fA-F]{24}$/.test(str) && ObjectId.isValid(str)) {
    try {
      return new ObjectId(str);
    } catch {
      return null;
    }
  }
  return null;
}

function buildMongoOrFilter(rawIds = [], extraFields = {}) {
  const strIds = new Set();
  const numIds = new Set();
  const objIds = [];

  for (const raw of rawIds) {
    if (raw === undefined || raw === null) continue;
    const s = String(raw).trim();
    if (!s) continue;
    strIds.add(s);
    try {
      const dec = decodeURIComponent(s).trim();
      if (dec) strIds.add(dec);
    } catch {}
  }

  for (const s of strIds) {
    if (!Number.isNaN(Number(s)) && String(Number(s)) === s) {
      numIds.add(Number(s));
    }
    const oid = toSafeObjectId(s);
    if (oid) objIds.push(oid);
  }

  const orConditions = [];
  const strArr = Array.from(strIds);
  const numArr = Array.from(numIds);

  if (strArr.length > 0) {
    orConditions.push({ _id: { $in: strArr } }, { id: { $in: strArr } });
  }
  if (numArr.length > 0) {
    orConditions.push({ _id: { $in: numArr } }, { id: { $in: numArr } });
  }
  if (objIds.length > 0) {
    orConditions.push({ _id: { $in: objIds } });
  }

  for (const [field, val] of Object.entries(extraFields)) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      orConditions.push({ [field]: String(val).trim() });
    }
  }

  return orConditions.length > 0 ? { $or: orConditions } : null;
}

const PUBLIC_CERTS_DIR = path.resolve(__dirname, '../../public/certificates');
const PUBLIC_CERT_PREVIEWS_DIR = path.resolve(__dirname, '../../public/certificates/previews');
const PUBLIC_IMAGES_DIR = path.resolve(__dirname, '../../public/images');
try {
  if (!fs.existsSync(PUBLIC_CERTS_DIR)) {
    fs.mkdirSync(PUBLIC_CERTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_CERT_PREVIEWS_DIR)) {
    fs.mkdirSync(PUBLIC_CERT_PREVIEWS_DIR, { recursive: true });
  }
  if (!fs.existsSync(PUBLIC_IMAGES_DIR)) {
    fs.mkdirSync(PUBLIC_IMAGES_DIR, { recursive: true });
  }
} catch {}

function offloadBase64MediaToDisk(base64Str, fallbackIdPrefix = 'doc', options = {}) {
  if (typeof base64Str !== 'string' || !base64Str.startsWith('data:') || base64Str.length <= 2000) {
    return base64Str;
  }
  try {
    const isPdf = base64Str.startsWith('data:application/pdf');
    const isPng = base64Str.startsWith('data:image/png');
    const isJpg = base64Str.startsWith('data:image/jpeg') || base64Str.startsWith('data:image/jpg');
    const isWebp = base64Str.startsWith('data:image/webp');
    if (!isPdf && !isPng && !isJpg && !isWebp) {
      return base64Str;
    }
    const ext = isPdf ? 'pdf' : isPng ? 'png' : isWebp ? 'webp' : 'jpg';
    const rawId = String(fallbackIdPrefix || `doc_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${rawId}.${ext}`;
    const targetDir = options.isPreview ? PUBLIC_CERT_PREVIEWS_DIR : PUBLIC_CERTS_DIR;
    const publicPrefix = options.isPreview ? '/certificates/previews' : '/certificates';
    const diskPath = path.join(targetDir, fileName);
    const commaIdx = base64Str.indexOf(',');
    const b64Payload = commaIdx !== -1 ? base64Str.slice(commaIdx + 1) : base64Str;
    fs.writeFileSync(diskPath, Buffer.from(b64Payload, 'base64'));
    const vTag = options.versionTag || Date.now();
    return options.noQuery ? `${publicPrefix}/${fileName}` : `${publicPrefix}/${fileName}?v=${vTag}`;
  } catch {
    return base64Str;
  }
}

function deduplicateDocMedia(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const clone = { ...doc };
  const docIdPrefix = String(clone.id || clone._id || `doc_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const vTag = clone.updatedAt ? new Date(clone.updatedAt).getTime() || Date.now() : Date.now();

  // Keep /public/images/profile-hero.jpg synced whenever profile heroImage is a base64 image
  if (typeof clone.heroImage === 'string' && clone.heroImage.startsWith('data:image/')) {
    try {
      const commaIdx = clone.heroImage.indexOf(',');
      const b64 = commaIdx !== -1 ? clone.heroImage.slice(commaIdx + 1) : clone.heroImage;
      fs.writeFileSync(path.join(PUBLIC_IMAGES_DIR, 'profile-hero.jpg'), Buffer.from(b64, 'base64'));
    } catch {}
  }

  // Handle nested certificate object (e.g., inside Experience documents)
  if (clone.certificate && typeof clone.certificate === 'object') {
    const certClone = { ...clone.certificate };
    const certPrefix = String(certClone.id || `${docIdPrefix}_cert`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const cFile = typeof certClone.file === 'string' ? certClone.file : '';
    const cImg = typeof certClone.image === 'string' ? certClone.image : '';
    const cPrev = typeof certClone.preview === 'string' ? certClone.preview : '';

    const cBase64Pdf =
      (cFile.startsWith('data:application/pdf') && cFile) ||
      (cImg.startsWith('data:application/pdf') && cImg) ||
      (cPrev.startsWith('data:application/pdf') && cPrev) ||
      '';
    const cBase64Img =
      (cPrev.startsWith('data:image/') && cPrev) ||
      (cImg.startsWith('data:image/') && cImg) ||
      (cFile.startsWith('data:image/') && cFile) ||
      '';

    if (cBase64Pdf) {
      const offloadedPdfUrl = offloadBase64MediaToDisk(cBase64Pdf, certPrefix, { noQuery: true });
      certClone.file = offloadedPdfUrl;
      if (cBase64Img) {
        const offloadedPrevUrl = offloadBase64MediaToDisk(cBase64Img, certPrefix, {
          isPreview: true,
          versionTag: vTag,
        });
        certClone.preview = offloadedPrevUrl;
        certClone.image = offloadedPrevUrl;
      } else {
        if (cImg === cBase64Pdf) certClone.image = '';
        if (cPrev === cBase64Pdf) certClone.preview = '';
        const candidatePng = path.join(PUBLIC_CERT_PREVIEWS_DIR, `${certPrefix}.png`);
        if (!certClone.preview && fs.existsSync(candidatePng)) {
          certClone.preview = `/certificates/previews/${certPrefix}.png`;
          certClone.image = `/certificates/previews/${certPrefix}.png`;
        }
      }
    } else if (cBase64Img) {
      const offloadedImgUrl = offloadBase64MediaToDisk(cBase64Img, `${certPrefix}_img`, {
        versionTag: vTag,
      });
      certClone.image = offloadedImgUrl;
      certClone.preview = offloadedImgUrl;
      if (!cFile || cFile === cBase64Img) {
        certClone.file = offloadedImgUrl;
      }
    }
    clone.certificate = certClone;
  }

  // Handle Profile base64 resumeUrl if uploaded
  if (typeof clone.resumeUrl === 'string' && clone.resumeUrl.startsWith('data:application/pdf')) {
    clone.resumeUrl = offloadBase64MediaToDisk(clone.resumeUrl, 'custom_resume', { versionTag: vTag });
  }

  // Top-level file, image, and preview (Certifications & Projects)
  const fileStr = typeof clone.file === 'string' ? clone.file : '';
  const imgStr = typeof clone.image === 'string' ? clone.image : '';
  const prevStr = typeof clone.preview === 'string' ? clone.preview : '';

  const base64Pdf =
    (fileStr.startsWith('data:application/pdf') && fileStr) ||
    (imgStr.startsWith('data:application/pdf') && imgStr) ||
    (prevStr.startsWith('data:application/pdf') && prevStr) ||
    '';

  const base64Img =
    (prevStr.startsWith('data:image/') && prevStr) ||
    (imgStr.startsWith('data:image/') && imgStr) ||
    (fileStr.startsWith('data:image/') && fileStr) ||
    '';

  if (base64Pdf && base64Pdf.length > 2000) {
    const resolvedFileUrl = offloadBase64MediaToDisk(base64Pdf, docIdPrefix, { noQuery: true });
    clone.file = resolvedFileUrl;
    if (base64Img && base64Img.length > 200) {
      const resolvedPrevUrl = offloadBase64MediaToDisk(base64Img, docIdPrefix, {
        isPreview: true,
        versionTag: vTag,
      });
      clone.preview = resolvedPrevUrl;
      clone.image = resolvedPrevUrl;
    } else {
      if (imgStr === base64Pdf) clone.image = '';
      if (prevStr === base64Pdf) clone.preview = '';
      const baseName = String(resolvedFileUrl)
        .split('?')[0]
        .replace(/^\/certificates\//, '')
        .replace(/\.pdf$/i, '');
      if (baseName && !clone.preview && fs.existsSync(path.join(PUBLIC_CERT_PREVIEWS_DIR, `${baseName}.png`))) {
        clone.preview = `/certificates/previews/${baseName}.png`;
        clone.image = `/certificates/previews/${baseName}.png`;
      }
    }
  } else if (base64Img && base64Img.length > 2000) {
    const resolvedImgUrl = offloadBase64MediaToDisk(base64Img, `${docIdPrefix}_img`, {
      versionTag: vTag,
    });
    clone.image = resolvedImgUrl;
    if (prevStr === base64Img || !prevStr) {
      clone.preview = resolvedImgUrl;
    }
    if (fileStr === base64Img) {
      clone.file = resolvedImgUrl;
    }
  } else if (
    fileStr.startsWith('/certificates/') &&
    fileStr.split('?')[0].toLowerCase().endsWith('.pdf') &&
    (!prevStr || !imgStr)
  ) {
    const baseName = fileStr
      .split('?')[0]
      .replace(/^\/certificates\//, '')
      .replace(/\.pdf$/i, '');
    if (baseName && fs.existsSync(path.join(PUBLIC_CERT_PREVIEWS_DIR, `${baseName}.png`))) {
      const existingPrev = `/certificates/previews/${baseName}.png`;
      if (!clone.preview) clone.preview = existingPrev;
      if (!clone.image) clone.image = existingPrev;
    }
  }
  return clone;
}

export class MongoCollection {
  constructor(collectionName, initialData = [], dbOwner = null) {
    this.collectionName = collectionName;
    this.dbOwner = dbOwner;
    this.filePath = path.join(DATA_DIR, `${collectionName}.json`);
    this.memoryCache = [];
    this.realCollection = null;
    this._pendingWrites = 0;
    this._writeVersion = 0;
    this._lastLocalWriteAt = 0;
    this._lastAtlasPull = 0;
    this._lastDiskMtime = 0;
    this._lastDiskCheckAt = 0;
    this._pullPromise = null;
    this.loadData(initialData);
  }

  emitChange(action = 'SYNC', targetId = null) {
    try {
      realtimeBus.emit('change', {
        collection: this.collectionName,
        action,
        targetId,
        timestamp: new Date().toISOString(),
      });
    } catch {}
  }

  async ensureConnected() {
    if (this.dbOwner && this.dbOwner._connectPromise) {
      try {
        await withTimeout(this.dbOwner._connectPromise, 3500);
      } catch {}
    }
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
    return false;
  }

  normalizeRemoteDoc(doc) {
    if (!doc || typeof doc !== 'object') return doc;
    const resolvedId = doc.id !== undefined && doc.id !== null ? doc.id : String(doc._id);
    const resolvedMongoId = doc._id !== undefined && doc._id !== null ? String(doc._id) : String(resolvedId);
    return deduplicateDocMedia({
      ...doc,
      id: resolvedId,
      _id: resolvedMongoId,
    });
  }

  syncFromDiskIfChanged() {
    if (this._pendingWrites > 0) return false;
    const now = Date.now();
    if (now - this._lastDiskCheckAt < 500) return false;
    this._lastDiskCheckAt = now;
    try {
      if (!fs.existsSync(this.filePath)) return false;
      const stat = fs.statSync(this.filePath);
      if (this._lastDiskMtime && stat.mtimeMs > this._lastDiskMtime + 50) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const deletedSet = this.getDeletedSet();
          this.memoryCache = parsed
            .filter((item) => !this.isDocDeleted(item, deletedSet))
            .map((item) => deduplicateDocMedia(item));
          this._lastDiskMtime = stat.mtimeMs;
          this.emitChange('DISK_RELOAD');
          return true;
        }
      }
    } catch {}
    return false;
  }

  async bindRealCollection(col) {
    this.realCollection = col;
    try {
      const startVersion = this._writeVersion;
      const remoteDocs = await withTimeout(col.find({}).toArray(), 4500);
      if (this._writeVersion !== startVersion) return;
      const deletedSet = this.getDeletedSet();

      if (remoteDocs && remoteDocs.length > 0) {
        const localById = new Map();
        for (const localItem of this.memoryCache || []) {
          const key = String(localItem.id ?? localItem._id);
          if (key) localById.set(key, localItem);
        }

        const remoteById = new Map();
        for (const rawRemote of remoteDocs) {
          const wasHugeBase64 =
            (typeof rawRemote.file === 'string' &&
              rawRemote.file.startsWith('data:application/pdf') &&
              rawRemote.file.length > 50000) ||
            (typeof rawRemote.certificate?.file === 'string' &&
              rawRemote.certificate.file.startsWith('data:application/pdf') &&
              rawRemote.certificate.file.length > 50000);
          const normalized = this.normalizeRemoteDoc(rawRemote);
          if (this.isDocDeleted(normalized, deletedSet)) {
            const delFilter = buildMongoOrFilter([rawRemote._id, rawRemote.id, normalized._id, normalized.id]);
            if (delFilter) {
              col.deleteMany(delFilter).catch(() => {});
            }
            continue;
          }
          if (wasHugeBase64) {
            const filter = buildMongoOrFilter([rawRemote._id, rawRemote.id]);
            if (filter) {
              const { _id: _omit, ...slimPayload } = normalized;
              col.updateMany(filter, { $set: slimPayload }).catch(() => {});
            }
          }

          const rKey = String(normalized.id ?? normalized._id);
          const localDoc = localById.get(rKey);
          let chosen = normalized;
          if (localDoc) {
            const localTime = localDoc.updatedAt ? new Date(localDoc.updatedAt).getTime() : 0;
            const remoteTime = normalized.updatedAt ? new Date(normalized.updatedAt).getTime() : 0;
            if (localTime > remoteTime) {
              chosen = localDoc;
              const { _id: _omit, ...safeLocal } = localDoc;
              const syncFilter = buildMongoOrFilter([rawRemote._id, rawRemote.id, localDoc._id, localDoc.id]);
              if (syncFilter) {
                col.updateMany(syncFilter, { $set: safeLocal }).catch(() => {});
              }
            } else if (localDoc.seo?.metaTitle && (!normalized.seo || !normalized.seo.metaTitle)) {
              chosen = { ...normalized, seo: localDoc.seo };
            }
          }

          const prevInMap = remoteById.get(rKey);
          if (!prevInMap) {
            remoteById.set(rKey, chosen);
          } else {
            const prevTime = prevInMap.updatedAt ? new Date(prevInMap.updatedAt).getTime() : 0;
            const curTime = chosen.updatedAt ? new Date(chosen.updatedAt).getTime() : 0;
            if (curTime >= prevTime) {
              remoteById.set(rKey, chosen);
            }
          }
        }

        // Preserve any very recently created local docs not yet visible in remoteById
        for (const [lKey, lDoc] of localById.entries()) {
          if (!remoteById.has(lKey) && !this.isDocDeleted(lDoc, deletedSet)) {
            const lTime = lDoc.updatedAt ? new Date(lDoc.updatedAt).getTime() : 0;
            if (lTime > Date.now() - 60000) {
              remoteById.set(lKey, lDoc);
              const { _id: _omit, ...safeLocal } = lDoc;
              col.updateOne({ _id: String(lDoc._id || lKey) }, { $set: safeLocal }, { upsert: true }).catch(() => {});
            }
          }
        }

        // Authoritative ordering: new remote docs first, then existing order for docs present in remoteById
        const finalMergedList = [];
        const addedKeys = new Set();
        for (const [rKey, rDoc] of remoteById.entries()) {
          if (!localById.has(rKey)) {
            finalMergedList.push(rDoc);
            addedKeys.add(rKey);
          }
        }
        for (const [lKey] of localById.entries()) {
          if (!addedKeys.has(lKey) && remoteById.has(lKey)) {
            finalMergedList.push(remoteById.get(lKey));
            addedKeys.add(lKey);
          }
        }
        for (const [rKey, rDoc] of remoteById.entries()) {
          if (!addedKeys.has(rKey)) {
            finalMergedList.push(rDoc);
            addedKeys.add(rKey);
          }
        }

        this.memoryCache = finalMergedList;
        this._lastAtlasPull = Date.now();
        this.saveData();
      } else if (this.memoryCache && this.memoryCache.length > 0) {
        // Seed initial data into empty MongoDB Atlas collection
        this.memoryCache = this.memoryCache.filter((item) => !this.isDocDeleted(item, deletedSet));
        this.saveData();
        for (const item of this.memoryCache) {
          try {
            const docId = item.id || item._id;
            const { _id: _omit, ...rest } = item;
            await col.updateOne(
              { _id: docId },
              { $set: { ...rest, id: docId } },
              { upsert: true }
            );
          } catch {}
        }
        this._lastAtlasPull = Date.now();
      } else {
        this._lastAtlasPull = Date.now();
      }
    } catch (err) {
      console.warn(`[MongoDB Node.js] Sync notice on ${this.collectionName}:`, err.message);
    }
  }

  // Real-time pull from live MongoDB Atlas so any changes in Atlas or other instances immediately reflect in Backend, Admin & Portfolio Frontend
  async pullFromAtlas(force = false) {
    if (!this.realCollection) return;
    if (this._pendingWrites > 0) return;

    const now = Date.now();
    // Always protect local mutations for 4.5s after any local write/delete so immediate sync=1 polls never overwrite fresh edits
    if (this._lastLocalWriteAt && now - this._lastLocalWriteAt < 4500) {
      return;
    }
    if (!force && this._lastAtlasPull && now - this._lastAtlasPull < 3500) {
      return;
    }

    if (this._pullPromise) {
      await this._pullPromise.catch(() => {});
      return;
    }

    this._lastAtlasPull = now;
    const startVersion = this._writeVersion;
    this._pullPromise = (async () => {
      try {
        const remoteDocs = await withTimeout(this.realCollection.find({}).toArray(), 3500);
        // CRITICAL: If a write or delete happened while this pull was in flight, discard stale pull!
        if (this._pendingWrites > 0 || this._writeVersion !== startVersion) return;
        if (Array.isArray(remoteDocs)) {
          const deletedSet = this.getDeletedSet();
          const localById = new Map();
          for (const localItem of this.memoryCache || []) {
            const k = String(localItem.id ?? localItem._id);
            if (k) localById.set(k, localItem);
          }

          const remoteById = new Map();
          for (const doc of remoteDocs) {
            const normalized = this.normalizeRemoteDoc(doc);
            if (this.isDocDeleted(normalized, deletedSet)) {
              const delFilter = buildMongoOrFilter([doc._id, doc.id, normalized._id, normalized.id]);
              if (delFilter && this.realCollection) {
                this.realCollection.deleteMany(delFilter).catch(() => {});
              }
              continue;
            }
            const rKey = String(normalized.id ?? normalized._id);
            const localDoc = localById.get(rKey);
            let chosen = normalized;
            if (localDoc) {
              const localTime = localDoc.updatedAt ? new Date(localDoc.updatedAt).getTime() : 0;
              const remoteTime = normalized.updatedAt ? new Date(normalized.updatedAt).getTime() : 0;
              if (localTime > remoteTime) {
                chosen = localDoc;
                const { _id: _omit, ...safeLocal } = localDoc;
                const syncFilter = buildMongoOrFilter([doc._id, doc.id, localDoc._id, localDoc.id]);
                if (syncFilter && this.realCollection) {
                  this.realCollection.updateMany(syncFilter, { $set: safeLocal }).catch(() => {});
                }
              } else if (localDoc.seo?.metaTitle && (!normalized.seo || !normalized.seo.metaTitle)) {
                chosen = { ...normalized, seo: localDoc.seo };
              }
            }
            const prevInMap = remoteById.get(rKey);
            if (!prevInMap) {
              remoteById.set(rKey, chosen);
            } else {
              const prevTime = prevInMap.updatedAt ? new Date(prevInMap.updatedAt).getTime() : 0;
              const chosenTime = chosen.updatedAt ? new Date(chosen.updatedAt).getTime() : 0;
              if (chosenTime >= prevTime) {
                remoteById.set(rKey, chosen);
              }
            }
          }

          // Preserve any recently created/updated local item not yet reflected in Atlas
          for (const [lKey, lDoc] of localById.entries()) {
            if (!remoteById.has(lKey) && !this.isDocDeleted(lDoc, deletedSet)) {
              const lTime = lDoc.updatedAt ? new Date(lDoc.updatedAt).getTime() : 0;
              if (lTime > Date.now() - 60000) {
                remoteById.set(lKey, lDoc);
                if (this.realCollection) {
                  const { _id: _omit, ...safeLocal } = lDoc;
                  this.realCollection
                    .updateOne({ _id: String(lDoc._id || lKey) }, { $set: safeLocal }, { upsert: true })
                    .catch(() => {});
                }
              }
            }
          }

          if (this._pendingWrites > 0 || this._writeVersion !== startVersion) return;

          const orderedMerged = [];
          const addedKeys = new Set();
          // 1. Prepend any newly created remote items not yet in localById
          for (const [rKey, rDoc] of remoteById.entries()) {
            if (!localById.has(rKey)) {
              orderedMerged.push(rDoc);
              addedKeys.add(rKey);
            }
          }
          // 2. Preserve existing order for items present in remoteById (items deleted from Atlas are automatically dropped)
          for (const [lKey] of localById.entries()) {
            if (!addedKeys.has(lKey) && remoteById.has(lKey)) {
              orderedMerged.push(remoteById.get(lKey));
              addedKeys.add(lKey);
            }
          }
          // 3. Any remaining remote items
          for (const [rKey, rDoc] of remoteById.entries()) {
            if (!addedKeys.has(rKey)) {
              orderedMerged.push(rDoc);
              addedKeys.add(rKey);
            }
          }

          const prevJson = JSON.stringify(this.memoryCache);
          const nextJson = JSON.stringify(orderedMerged);
          if (prevJson !== nextJson && (orderedMerged.length > 0 || remoteDocs.length === 0)) {
            this.memoryCache = orderedMerged;
            this.saveData();
            this.emitChange('ATLAS_SYNC');
          }
        }
      } catch {
        // ignore transient network glitch
      } finally {
        this._lastAtlasPull = Date.now();
        this._pullPromise = null;
      }
    })();

    await this._pullPromise;
  }

  loadData(seedData = []) {
    try {
      const deletedSet = this.getDeletedSet();
      if (fs.existsSync(this.filePath)) {
        const stat = fs.statSync(this.filePath);
        this._lastDiskMtime = stat.mtimeMs;
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        let modified = false;
        this.memoryCache = (Array.isArray(parsed) ? parsed : [])
          .filter((item) => !this.isDocDeleted(item, deletedSet))
          .map((item) => {
            const hadHugePdf =
              (typeof item?.file === 'string' &&
                item.file.startsWith('data:application/pdf') &&
                item.file.length > 50000) ||
              (typeof item?.certificate?.file === 'string' &&
                item.certificate.file.startsWith('data:application/pdf') &&
                item.certificate.file.length > 50000);
            const cleaned = deduplicateDocMedia(item);
            if (hadHugePdf) {
              modified = true;
            }
            return cleaned;
          });
        if (modified) {
          this.saveData();
        }
      } else {
        this.memoryCache = seedData
          .map((item) =>
            deduplicateDocMedia({
              ...item,
              _id: item._id || item.id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString(),
            })
          )
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
      try {
        this._lastDiskMtime = fs.statSync(this.filePath).mtimeMs;
      } catch {}
    } catch {
      this._diskQueue = (this._diskQueue || Promise.resolve())
        .then(async () => {
          await fs.promises.writeFile(this.filePath, serialized, 'utf-8');
          try {
            this._lastDiskMtime = fs.statSync(this.filePath).mtimeMs;
          } catch {}
        })
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

  async find(query = {}, options = {}) {
    await this.ensureConnected();
    this.syncFromDiskIfChanged();
    await this.pullFromAtlas(Boolean(options?.force)).catch(() => {});
    const deletedSet = this.getDeletedSet();
    const cleanCache = this.memoryCache.filter((item) => !this.isDocDeleted(item, deletedSet));
    if (cleanCache.length !== this.memoryCache.length) {
      this.memoryCache = cleanCache;
      this.saveData();
    }
    if (!query || Object.keys(query).length === 0) {
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
    await this.ensureConnected();
    this.syncFromDiskIfChanged();
    await this.pullFromAtlas(false).catch(() => {});
    const rawStr = String(id).trim();
    let decodedStr = rawStr;
    try {
      decodedStr = decodeURIComponent(rawStr).trim();
    } catch {}
    const lowerStr = decodedStr.toLowerCase();

    // 1. Always match strictly by _id or id first so items sharing a title/role never collide
    const exactIdMatch =
      this.memoryCache.find(
        (item) =>
          String(item._id) === rawStr ||
          String(item.id) === rawStr ||
          String(item._id) === decodedStr ||
          String(item.id) === decodedStr
      ) || null;
    if (exactIdMatch) return exactIdMatch;

    // 2. Only for skills collection, allow fallback lookup by skill name if no ID matched
    if (this.collectionName === 'skills') {
      const skillNameMatch =
        this.memoryCache.find(
          (item) =>
            item.name &&
            (String(item.name) === decodedStr || String(item.name).toLowerCase() === lowerStr)
        ) || null;
      if (skillNameMatch) return skillNameMatch;
    }

    if (this.realCollection && !this.getDeletedSet().has(rawStr) && !this.getDeletedSet().has(decodedStr)) {
      try {
        const filter = buildMongoOrFilter(
          [rawStr, decodedStr],
          this.collectionName === 'skills' ? { name: decodedStr } : {}
        );
        if (filter) {
          const doc = await withTimeout(this.realCollection.findOne(filter), 2500);
          if (doc) return this.normalizeRemoteDoc(doc);
        }
      } catch {
        // fallback
      }
    }
    return null;
  }

  async insertOne(doc) {
    await this.ensureConnected();
    this._writeVersion++;
    this._lastLocalWriteAt = Date.now();
    const now = new Date().toISOString();
    const id = doc.id || doc._id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const strId = String(id);
    const cleanedDoc = deduplicateDocMedia({ ...doc, id, _id: strId });
    const newDoc = {
      ...cleanedDoc,
      _id: strId,
      id,
      createdAt: doc.createdAt || now,
      updatedAt: now,
    };

    // Unmark from deleted registry if re-created with this ID or skill name
    this.unmarkIdsDeleted([strId, ...(newDoc.name ? [newDoc.name] : [])]);

    // Immediately update memoryCache & local JSON
    this.memoryCache = this.memoryCache.filter(
      (item) => String(item.id) !== strId && String(item._id) !== strId
    );
    this.memoryCache.unshift(newDoc);
    this._lastAtlasPull = Date.now();
    this.saveData();

    // Sync to live MongoDB Atlas and await completion so Atlas is immediately consistent
    if (this.realCollection) {
      const col = this.realCollection;
      this._pendingWrites++;
      const syncTask = this.enqueueMongoSync(async () => {
        try {
          const stillInMemory = this.memoryCache.some(
            (item) => String(item.id) === strId || String(item._id) === strId
          );
          if (!stillInMemory) return;

          const { _id: _omit, ...safePayload } = newDoc;
          const filter = buildMongoOrFilter([id, strId]);
          const res = filter ? await col.updateMany(filter, { $set: safePayload }) : { matchedCount: 0 };
          if (!res || res.matchedCount === 0) {
            await col.updateOne(
              { _id: strId },
              { $set: safePayload },
              { upsert: true }
            );
          }
        } finally {
          this._pendingWrites = Math.max(0, this._pendingWrites - 1);
          this._lastLocalWriteAt = Date.now();
          this._lastAtlasPull = Date.now();
        }
      });
      await withTimeout(syncTask, 5000).catch(() => {});
    }

    this.emitChange('CREATE', strId);
    return newDoc;
  }

  async create(doc) {
    return this.insertOne(doc);
  }

  async updateOne(filter, updates) {
    await this.ensureConnected();
    this._writeVersion++;
    this._lastLocalWriteAt = Date.now();
    const now = new Date().toISOString();
    const targetId = filter._id !== undefined ? filter._id : filter.id;
    const strTargetId = targetId !== undefined ? String(targetId).trim() : null;
    let decodedTargetId = strTargetId;
    if (strTargetId !== null) {
      try {
        decodedTargetId = decodeURIComponent(strTargetId).trim();
      } catch {}
    }

    const patch = deduplicateDocMedia({
      ...updates,
      ...(strTargetId ? { id: updates.id || decodedTargetId } : {}),
      updatedAt: now,
    });

    // 1. Strict ID match first so editing one experience/project never matches a different record with the same role/title
    let index = this.memoryCache.findIndex((item) => {
      if (strTargetId !== null) {
        return (
          String(item._id) === strTargetId ||
          String(item.id) === strTargetId ||
          String(item._id) === decodedTargetId ||
          String(item.id) === decodedTargetId
        );
      }
      return Object.entries(filter).every(([k, v]) => String(item[k]) === String(v));
    });

    // 2. Fallback by name only for skills collection
    if (index === -1 && strTargetId !== null && this.collectionName === 'skills') {
      index = this.memoryCache.findIndex(
        (item) => item.name && String(item.name).toLowerCase() === decodedTargetId.toLowerCase()
      );
    }

    let updatedDoc = null;
    if (index === -1) {
      const existing = strTargetId !== null ? await this.findById(strTargetId) : await this.findOne(filter);
      if (existing) {
        const docId = existing._id || existing.id || strTargetId;
        this._writeVersion++;
        updatedDoc = deduplicateDocMedia({
          ...existing,
          ...patch,
          _id: String(docId),
          id: existing.id ?? docId,
        });
        this.unmarkIdsDeleted([String(docId), String(updatedDoc.id), ...(updatedDoc.name ? [updatedDoc.name] : [])]);
        this.memoryCache.unshift(updatedDoc);
        this._lastAtlasPull = Date.now();
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
        _id: String(docId),
        id: current.id ?? docId,
      });
      this.unmarkIdsDeleted([String(docId), String(updatedDoc.id), ...(updatedDoc.name ? [updatedDoc.name] : [])]);
      this.memoryCache[index] = updatedDoc;
      this._lastAtlasPull = Date.now();
      this.saveData();
    }

    if (this.realCollection && updatedDoc) {
      const col = this.realCollection;
      const docToSync = { ...updatedDoc };
      this._pendingWrites++;
      const syncTask = this.enqueueMongoSync(async () => {
        try {
          const { _id: _omitId, ...safePatch } = docToSync;
          const candidateIds = [
            strTargetId,
            decodedTargetId,
            docToSync._id,
            docToSync.id,
          ].filter((v) => v !== undefined && v !== null);

          const mongoFilter =
            candidateIds.length > 0
              ? buildMongoOrFilter(
                  candidateIds,
                  this.collectionName === 'skills' && docToSync.name ? { name: docToSync.name } : {}
                )
              : { ...filter };

          const res = await col.updateMany(mongoFilter, { $set: safePatch });
          if (!res || res.matchedCount === 0) {
            const fallbackId = String(docToSync._id || docToSync.id || strTargetId);
            await col.updateOne(
              { _id: fallbackId },
              { $set: safePatch },
              { upsert: true }
            );
          }
        } finally {
          this._pendingWrites = Math.max(0, this._pendingWrites - 1);
          this._lastLocalWriteAt = Date.now();
          this._lastAtlasPull = Date.now();
        }
      });
      await withTimeout(syncTask, 5000).catch(() => {});
    }

    if (updatedDoc) {
      this.emitChange('UPDATE', String(updatedDoc.id || updatedDoc._id || strTargetId));
    }
    return updatedDoc;
  }

  async findByIdAndUpdate(id, updates) {
    return await this.updateOne({ _id: id }, updates);
  }

  async deleteOne(filter) {
    await this.ensureConnected();
    this._writeVersion++;
    this._lastLocalWriteAt = Date.now();
    const targetId = filter._id !== undefined ? filter._id : filter.id;
    const strTargetId = targetId !== undefined ? String(targetId).trim() : null;
    let decodedTargetId = strTargetId;
    if (strTargetId !== null) {
      try {
        decodedTargetId = decodeURIComponent(strTargetId).trim();
      } catch {}
    }
    const lowerTargetId = decodedTargetId !== null ? decodedTargetId.toLowerCase() : null;

    const beforeLen = this.memoryCache.length;
    const matchedDocs = [];

    // Check if there is an exact ID match in memoryCache first
    const hasExactIdMatch =
      strTargetId !== null &&
      this.memoryCache.some(
        (item) =>
          String(item._id) === strTargetId ||
          String(item.id) === strTargetId ||
          String(item._id) === decodedTargetId ||
          String(item.id) === decodedTargetId
      );

    this.memoryCache = this.memoryCache.filter((item) => {
      let isMatch = false;
      if (strTargetId !== null) {
        if (hasExactIdMatch) {
          isMatch =
            String(item._id) === strTargetId ||
            String(item.id) === strTargetId ||
            String(item._id) === decodedTargetId ||
            String(item.id) === decodedTargetId;
        } else if (this.collectionName === 'skills') {
          isMatch =
            item.name &&
            (String(item.name) === decodedTargetId ||
              String(item.name).toLowerCase() === lowerTargetId);
        }
      } else {
        isMatch = Object.entries(filter).every(([k, v]) => String(item[k]) === String(v));
      }
      if (isMatch) {
        matchedDocs.push(item);
      }
      return !isMatch;
    });

    const idsToTombstone = [strTargetId, decodedTargetId].filter(Boolean);
    for (const m of matchedDocs) {
      if (m._id !== undefined) idsToTombstone.push(String(m._id));
      if (m.id !== undefined) idsToTombstone.push(String(m.id));
    }
    this.markIdsDeleted(idsToTombstone);
    this._lastAtlasPull = Date.now();
    this.saveData();

    if (this.realCollection) {
      const col = this.realCollection;
      this._pendingWrites++;
      const syncTask = this.enqueueMongoSync(async () => {
        try {
          const mongoFilter =
            strTargetId !== null
              ? buildMongoOrFilter(
                  idsToTombstone,
                  this.collectionName === 'skills' ? { name: decodedTargetId } : {}
                )
              : { ...filter };

          if (mongoFilter) {
            await col.deleteMany(mongoFilter);
          }
        } finally {
          this._pendingWrites = Math.max(0, this._pendingWrites - 1);
          this._lastLocalWriteAt = Date.now();
          this._lastAtlasPull = Date.now();
        }
      });
      await withTimeout(syncTask, 4000).catch(() => {});
    }

    this.emitChange('DELETE', strTargetId);
    return this.memoryCache.length < beforeLen || Boolean(this.realCollection);
  }

  async findByIdAndDelete(id) {
    return await this.deleteOne({ _id: id });
  }

  async deleteMany(filter = {}) {
    await this.ensureConnected();
    this._writeVersion++;
    this._lastLocalWriteAt = Date.now();
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
    }
    this.markIdsDeleted(idsToTombstone);
    this._lastAtlasPull = Date.now();
    this.saveData();

    if (this.realCollection) {
      const col = this.realCollection;
      this._pendingWrites++;
      const syncTask = this.enqueueMongoSync(async () => {
        try {
          if (isClearAll) {
            await col.deleteMany({});
          } else if (idsToTombstone.length > 0) {
            await col.deleteMany({
              $or: [{ _id: { $in: idsToTombstone } }, { id: { $in: idsToTombstone } }, filter],
            });
          } else {
            await col.deleteMany(filter);
          }
        } finally {
          this._pendingWrites = Math.max(0, this._pendingWrites - 1);
          this._lastLocalWriteAt = Date.now();
          this._lastAtlasPull = Date.now();
        }
      });
      await withTimeout(syncTask, 4000).catch(() => {});
    }

    this.emitChange('CLEAR');
    return matchedDocs.length;
  }

  async countDocuments(query = {}) {
    await this.ensureConnected();
    this.syncFromDiskIfChanged();
    await this.pullFromAtlas(false).catch(() => {});
    const deletedSet = this.getDeletedSet();
    const cleanCache = this.memoryCache.filter((item) => !this.isDocDeleted(item, deletedSet));
    if (cleanCache.length !== this.memoryCache.length) {
      this.memoryCache = cleanCache;
      this.saveData();
    }
    if (!query || Object.keys(query).length === 0) {
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
    } catch {}

    this.uri =
      process.env.MONGODB_URI ||
      savedUri ||
      'mongodb+srv://sachinkumargheura_db_user:Sachin123@cluster0.jlcorya.mongodb.net/sachin_portfolio_db?retryWrites=true&w=majority';
    this.dbType = 'MongoDB NoSQL Database';
    this.isConnected = true;
    this.isLiveAtlas = false;
    this.realClient = null;
    this.realDb = null;

    this.projects = new MongoCollection('projects', initialProjects, this);
    this.certifications = new MongoCollection('certifications', initialCertifications, this);
    this.education = new MongoCollection('education', initialEducation, this);
    this.experience = new MongoCollection('experience', initialExperiences, this);
    this.skills = new MongoCollection('skills', defaultSkillsList, this);
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

    this.auditLogs = new MongoCollection('audit_logs', defaultAuditLogs, this);
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
    ], this);
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
    ], this);
    this.analytics = new MongoCollection('analytics', [
      {
        _id: 'stats',
        id: 'stats',
        pageViews: 1540,
        uniqueVisitors: 480,
      },
    ], this);
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
        passwordHash: '3989907f07980f390ab703b199ece0d71f732f9c4fe2071e13fe289be7e8e310',
        createdAt: new Date().toISOString(),
      },
    ], this);

    // Ensure initial experiences, skills, and project SEO metadata are present if empty
    if (!this.experience.memoryCache || this.experience.memoryCache.length === 0) {
      this.syncInitialExperiences().catch(() => null);
    }
    if (!this.skills.memoryCache || this.skills.memoryCache.length === 0) {
      this.syncInitialSkills().catch(() => null);
    }
    this.syncInitialProjectSeo().catch(() => null);

    // Store connection promise so cold-start requests can await it
    this._connectPromise = this.connectToRealMongo();
  }

  async pullAllFromAtlas(force = false) {
    if (!this.isLiveAtlas) return;
    await Promise.all([
      this.projects.pullFromAtlas(force),
      this.certifications.pullFromAtlas(force),
      this.education.pullFromAtlas(force),
      this.experience.pullFromAtlas(force),
      this.skills.pullFromAtlas(force),
      this.profile.pullFromAtlas(force),
      this.messages.pullFromAtlas(force),
      this.auditLogs.pullFromAtlas(force),
    ]).catch(() => {});
  }

  async syncInitialProjectSeo() {
    try {
      let modified = false;
      const nowIso = new Date().toISOString();
      this.projects.memoryCache = (this.projects.memoryCache || []).map((proj) => {
        if (proj.seo && proj.seo.metaTitle) return proj;
        modified = true;
        const techList = Array.isArray(proj.technologies) && proj.technologies.length > 0
          ? proj.technologies.join(', ')
          : Array.isArray(proj.tech) && proj.tech.length > 0
          ? proj.tech.join(', ')
          : 'React, Node.js, MongoDB';
        const primaryTech = Array.isArray(proj.technologies) && proj.technologies.length > 0
          ? proj.technologies.slice(0, 3).join(', ')
          : 'Full Stack';
        const cleanTitle = proj.title || 'Portfolio Project';
        let metaTitle = `${cleanTitle} – ${primaryTech} Project | Sachin Kumar`;
        if (metaTitle.length > 60) {
          metaTitle = `${cleanTitle} | Sachin Kumar Portfolio`;
        }
        const descPrefix = proj.description
          ? String(proj.description).replace(/\s+/g, ' ').trim()
          : `Production software engineering project built with ${techList}`;
        let metaDescription = `${cleanTitle}: ${descPrefix} Built by Sachin Kumar using ${primaryTech}.`;
        if (metaDescription.length > 158) {
          metaDescription = metaDescription.slice(0, 155).trim() + '...';
        }
        return {
          ...proj,
          seo: {
            metaTitle,
            metaDescription,
            keywords: `${cleanTitle}, ${proj.category || 'Full Stack'}, ${techList}, Sachin Kumar, Software Engineer Portfolio`,
            canonicalUrl: proj.live || proj.liveUrl || 'https://sachinkumar.dev/#projects',
            ogImage: proj.image || '/images/My_portfolio.png',
            twitterCard: 'summary_large_image',
            robots: 'index, follow',
            schemaType:
              String(proj.category || '').toLowerCase().includes('ai')
                ? 'SoftwareApplication'
                : 'WebApplication',
            author: 'Sachin Kumar',
            updatedAt: nowIso,
          },
        };
      });
      if (modified) {
        this.projects.saveData();
        if (this.projects.realCollection) {
          for (const item of this.projects.memoryCache) {
            try {
              const docId = item.id || item._id;
              await this.projects.realCollection.replaceOne(
                { _id: docId },
                { ...item, _id: docId, id: docId },
                { upsert: true }
              );
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('[MongoDB Node.js] syncInitialProjectSeo notice:', err.message);
    }
  }

  normalizeMongoUri(rawInput) {
    if (!rawInput) return '';
    let str = String(rawInput).trim();
    str = str.replace(/^MONGODB_URI\s*=\s*/i, '').replace(/^["']|["']$/g, '').trim();
    str = str.replace(/:<([^>]+)>@/, ':$1@');
    return str;
  }

  saveUriConfig(uri) {
    try {
      fs.writeFileSync(this.configFilePath, JSON.stringify({ uri, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    } catch {}
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

    if (
      targetUri.startsWith('mongodb://localhost') ||
      targetUri.startsWith('mongodb://127.0.0.1') ||
      targetUri === 'local'
    ) {
      this.uri = targetUri === 'local' ? 'mongodb://localhost:27017/sachin_portfolio_db' : targetUri;
      this.isConnected = true;
      this.isLiveAtlas = false;
      this.realCollection = null;
      this.saveUriConfig(this.uri);
      realtimeBus.emit('change', { collection: 'all', action: 'ENGINE_SWITCH', timestamp: new Date().toISOString() });
      return {
        success: true,
        databaseName: 'sachin_portfolio_db',
        isLiveAtlas: false,
        message: 'Successfully connected to MongoDB Local NoSQL Database Engine (sachin_portfolio_db)! All CRUD operations are active in real-time.',
      };
    }

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

        // Bind live collections in parallel directly from MongoDB Atlas
        await Promise.all([
          this.projects.bindRealCollection(this.realDb.collection('projects')),
          this.certifications.bindRealCollection(this.realDb.collection('certifications')),
          this.education.bindRealCollection(this.realDb.collection('education')),
          this.experience.bindRealCollection(this.realDb.collection('experience')),
          this.skills.bindRealCollection(this.realDb.collection('skills')),
          this.messages.bindRealCollection(this.realDb.collection('messages')),
          this.profile.bindRealCollection(this.realDb.collection('profile')),
          this.auditLogs.bindRealCollection(this.realDb.collection('audit_logs')),
          this.analytics.bindRealCollection(this.realDb.collection('analytics')),
          this.users.bindRealCollection(this.realDb.collection('users')),
        ]);

        await this.syncInitialProjectSeo();
        realtimeBus.emit('change', { collection: 'all', action: 'ATLAS_CONNECTED', timestamp: new Date().toISOString() });

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
      if (deletedSet.size > 0 && this.experience.memoryCache.length > 0) return;
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
    } catch (err) {
      console.warn('[MongoDB Node.js] syncInitialExperiences warning:', err.message);
    }
  }

  async syncInitialSkills() {
    try {
      const deletedSet = this.skills.getDeletedSet();
      if (deletedSet.size > 0 && this.skills.memoryCache.length > 0) return;
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
    } catch (err) {
      console.warn('[MongoDB Node.js] syncInitialSkills warning:', err.message);
    }
  }

  async autoSeedAtlasIfEmpty() {
    // Handled by bindRealCollection
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

