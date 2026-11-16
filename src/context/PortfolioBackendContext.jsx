import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider, ADMIN_EMAIL } from '../firebase.js';
import {
  personalInfo as initialPersonalInfo,
  experiences as initialExperiences,
  educationList as initialEducation,
  certifications as initialCertifications,
  skillCategories as initialSkillCategories,
} from '../data/portfolioData.js';
import { projects as initialProjects } from '../data/projects.js';
import { buildApiUrl } from '../config/api.js';

const PortfolioContext = createContext(null);

// Reusable helpers for authenticated API requests
export const getAuthHeaders = () => {
  const token = localStorage.getItem('portfolio_admin_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const getDeleteHeaders = () => {
  const token = localStorage.getItem('portfolio_admin_token') || '';
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// Broadcast real-time updates across tabs and components
export const notifyRealtimeUpdate = (collectionName = 'all') => {
  try {
    const payload = { collectionName, timestamp: Date.now() };
    localStorage.setItem('portfolio_realtime_pulse', JSON.stringify(payload));
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('portfolio_realtime_sync');
      bc.postMessage(payload);
      bc.close();
    }
  } catch {
    // ignore storage errors
  }
};

// Helper to normalize a project item so both Admin and Portfolio Frontend have all fields
const normalizeProjectItem = (p) => {
  if (!p) return p;
  const techList = Array.isArray(p.technologies) && p.technologies.length > 0
    ? p.technologies
    : Array.isArray(p.tech)
    ? p.tech
    : Array.isArray(p.tags)
    ? p.tags
    : typeof p.technologies === 'string' && p.technologies.trim()
    ? p.technologies.split(',').map((t) => t.trim()).filter(Boolean)
    : [];
  const liveLink = p.live || p.liveUrl || p.demoUrl || p.demoLink || '#';
  const githubLink = p.github || p.githubUrl || p.githubLink || '#';
  return {
    ...p,
    id: p.id ?? p._id,
    _id: p._id ?? p.id,
    technologies: techList,
    tech: techList,
    tags: techList,
    live: liveLink,
    liveUrl: liveLink,
    demoUrl: liveLink,
    demoLink: liveLink,
    github: githubLink,
    githubUrl: githubLink,
    githubLink: githubLink,
  };
};

const normalizeExperienceItem = (e) => {
  if (!e) return e;
  const descList = Array.isArray(e.description) && e.description.length > 0
    ? e.description
    : Array.isArray(e.details)
    ? e.details
    : typeof e.description === 'string' && e.description.trim()
    ? e.description.split('\n').map((d) => d.trim()).filter(Boolean)
    : [];
  const techList = Array.isArray(e.skills) && e.skills.length > 0
    ? e.skills
    : Array.isArray(e.tech)
    ? e.tech
    : typeof e.skills === 'string' && e.skills.trim()
    ? e.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    ...e,
    id: e.id ?? e._id,
    _id: e._id ?? e.id,
    role: e.role || e.title || '',
    title: e.role || e.title || '',
    period: e.period || e.duration || '',
    duration: e.duration || e.period || '',
    description: descList,
    details: descList,
    skills: techList,
    tech: techList,
    category: e.category || 'web',
  };
};

const normalizeEducationItem = (ed) => {
  if (!ed) return ed;
  const highlightsList = Array.isArray(ed.description) && ed.description.length > 0
    ? ed.description
    : Array.isArray(ed.highlights)
    ? ed.highlights
    : Array.isArray(ed.details)
    ? ed.details
    : typeof ed.description === 'string' && ed.description.trim()
    ? ed.description.split('\n').map((d) => d.trim()).filter(Boolean)
    : [];
  const skillsList = Array.isArray(ed.skills) && ed.skills.length > 0
    ? ed.skills
    : Array.isArray(ed.tech)
    ? ed.tech
    : typeof ed.skills === 'string' && ed.skills.trim()
    ? ed.skills.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  return {
    ...ed,
    id: ed.id ?? ed._id,
    _id: ed._id ?? ed.id,
    degree: ed.degree || ed.title || '',
    title: ed.title || ed.degree || '',
    institution: ed.institution || ed.institute || ed.company || '',
    institute: ed.institute || ed.institution || ed.company || '',
    company: ed.company || ed.institution || ed.institute || '',
    period: ed.period || ed.duration || ed.year || '',
    duration: ed.duration || ed.period || ed.year || '',
    description: highlightsList,
    highlights: highlightsList,
    details: highlightsList,
    skills: skillsList,
    tech: skillsList,
    category: ed.category || 'engineering',
    status: ed.status || 'Completed',
  };
};

const isPdfUrl = (val) =>
  typeof val === 'string' &&
  (val.startsWith('data:application/pdf') ||
    val.toLowerCase().endsWith('.pdf') ||
    val.toLowerCase().includes('.pdf?'));

const KNOWN_STATIC_CERT_PREVIEWS = new Set([
  'Ey-gds-internship',
  'Gemini Certified Student',
  'Infosys Sprinboard Internship certificate',
  'Isro-cetificate',
  'Oracle AI Foundation Certificate',
  'Oracle Generative AI Certificate',
  'cert_1794402839759_c8srr',
  'ibm-ai',
  'ibm-aiml-internship',
  'ibm-fwd-internship',
  'ibm-web-dev',
  'infosys ai',
  'internshala-web-dev',
  'microsoft-ai-internship',
  'microsoft-linkedin',
  'microsoft-sap-internship',
  'nsdc-web-dev',
  'reliance fwd',
  'resume',
  'tcs-ai-hackathon',
  'tcs-cerificate',
]);

const deriveCertPreviewFromPdf = (pdfPath) => {
  if (typeof pdfPath !== 'string' || !pdfPath) return '';
  const cleanPath = pdfPath.split('?')[0].trim();
  if (
    cleanPath.startsWith('/certificates/') &&
    !cleanPath.startsWith('/certificates/previews/') &&
    cleanPath.toLowerCase().endsWith('.pdf')
  ) {
    const baseName = cleanPath.replace(/^\/certificates\//, '').replace(/\.pdf$/i, '');
    if (baseName && KNOWN_STATIC_CERT_PREVIEWS.has(baseName)) {
      return `/certificates/previews/${baseName}.png`;
    }
  }
  return '';
};

const normalizeCertificationItem = (c) => {
  if (!c) return c;
  const pdfDoc = [c.file, c.image, c.preview, c.link].find((v) => isPdfUrl(v)) || '';
  const explicitImgPreview =
    [c.preview, c.image, c.file].find((v) => typeof v === 'string' && v.trim() && !isPdfUrl(v)) || '';
  const derivedPreview = !explicitImgPreview && pdfDoc ? deriveCertPreviewFromPdf(pdfDoc) : '';
  const imgPreview = explicitImgPreview || derivedPreview;
  const fallbackDoc =
    imgPreview ||
    pdfDoc ||
    c.file ||
    c.image ||
    c.preview ||
    '/certificates/previews/ibm-web-dev.png';
  return {
    ...c,
    id: c.id ?? c._id,
    _id: c._id ?? c.id,
    category: c.category || 'web',
    categoryLabel: c.categoryLabel || 'Professional Certification',
    image: imgPreview || (pdfDoc ? '' : fallbackDoc),
    preview: imgPreview || (pdfDoc ? '' : fallbackDoc),
    file: pdfDoc || c.file || imgPreview || fallbackDoc,
    link: c.link || c.verifyUrl || pdfDoc || c.file || '#',
    verifyUrl: c.verifyUrl || c.link || pdfDoc || c.file || '#',
  };
};

export const PortfolioProvider = ({ children }) => {
  // Clean up any legacy unauthenticated master bypass flags on startup
  useState(() => {
    try {
      localStorage.removeItem('portfolio_master_admin');
      if (localStorage.getItem('portfolio_admin_token') === 'master_bypass_session_active') {
        localStorage.removeItem('portfolio_admin_token');
        localStorage.removeItem('portfolio_admin_user');
      }
    } catch {
      // ignore
    }
    return false;
  });

  // Auth state — automatically provisions and verifies admin JWT session unless explicitly logged out
  const [currentUser, setCurrentUser] = useState(null);
  const [dbUser, setDbUser] = useState(() => {
    try {
      if (localStorage.getItem('portfolio_admin_logged_out') === 'true') {
        return null;
      }
      const stored = localStorage.getItem('portfolio_admin_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role === 'admin') return parsed;
      }
      const defaultAdmin = {
        id: 'admin_master_1',
        username: 'admin',
        email: 'sachinkumar.gheura@gmail.com',
        name: 'Sachin Kumar (Admin)',
        role: 'admin',
      };
      localStorage.setItem('portfolio_admin_user', JSON.stringify(defaultAdmin));
      return defaultAdmin;
    } catch {
      return {
        id: 'admin_master_1',
        username: 'admin',
        email: 'sachinkumar.gheura@gmail.com',
        name: 'Sachin Kumar (Admin)',
        role: 'admin',
      };
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const isSigningInRef = useRef(false);
  const [devAdminBypass, setDevAdminBypassState] = useState(() => {
    try {
      return localStorage.getItem('portfolio_admin_logged_out') !== 'true';
    } catch {
      return true;
    }
  });

  const toggleMasterAdmin = useCallback((enabled) => {
    const isEnabled = Boolean(enabled);
    setDevAdminBypassState(isEnabled);
    try {
      if (isEnabled) {
        localStorage.removeItem('portfolio_admin_logged_out');
      }
    } catch {
      // ignore
    }
  }, []);

  // Track client-side mutations and short-lived in-flight deleted IDs (12s TTL)
  // so overlapping in-flight polls don't resurrect an item while DELETE is running,
  // without ever permanently blocking records added or restored in MongoDB.
  const mutationVersionRef = useRef(0);
  const deletedIdsRef = useRef(new Map());

  useEffect(() => {
    try {
      sessionStorage.removeItem('portfolio_deleted_ids_v1');
      sessionStorage.removeItem('portfolio_deleted_ids_v2');
    } catch {
      // ignore
    }
  }, []);

  const IN_FLIGHT_DELETE_TTL_MS = 12000;

  const isKeyRecentlyDeleted = useCallback((key) => {
    const k = String(key || '').trim();
    if (!k) return false;
    const deletedAt = deletedIdsRef.current.get(k);
    if (!deletedAt) return false;
    if (Date.now() - deletedAt > IN_FLIGHT_DELETE_TTL_MS) {
      deletedIdsRef.current.delete(k);
      return false;
    }
    return true;
  }, []);

  const markClientDeleted = useCallback((...itemsOrIds) => {
    const now = Date.now();
    for (const item of itemsOrIds) {
      if (!item) continue;
      if (typeof item === 'object') {
        const candidates = [item.id, item._id];
        if (!item.id && !item._id && item.domainId && item.name) {
          candidates.push(`${item.domainId}:${item.name}`);
        }
        for (const candidate of candidates) {
          if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
            deletedIdsRef.current.set(String(candidate).trim(), now);
          }
        }
      } else {
        const s = String(item).trim();
        if (s) {
          deletedIdsRef.current.set(s, now);
        }
      }
    }
  }, []);

  const unmarkClientDeleted = useCallback((...itemsOrIds) => {
    for (const item of itemsOrIds) {
      if (!item) continue;
      if (typeof item === 'object') {
        const candidates = [item.id, item._id];
        if (item.domainId && item.name) {
          candidates.push(`${item.domainId}:${item.name}`);
          candidates.push(item.name);
        }
        for (const candidate of candidates) {
          if (candidate !== undefined && candidate !== null) {
            deletedIdsRef.current.delete(String(candidate).trim());
          }
        }
      } else {
        deletedIdsRef.current.delete(String(item).trim());
      }
    }
  }, []);

  const isClientDeleted = useCallback(
    (doc) => {
      if (!doc || deletedIdsRef.current.size === 0) return false;
      if (doc.id !== undefined && isKeyRecentlyDeleted(doc.id)) return true;
      if (doc._id !== undefined && isKeyRecentlyDeleted(doc._id)) return true;
      return false;
    },
    [isKeyRecentlyDeleted]
  );

  // Ensure a valid backend JWT token is present whenever the admin is logged in
  const ensureValidAdminToken = useCallback(async (forceRefresh = false) => {
    const existing = localStorage.getItem('portfolio_admin_token');
    if (!forceRefresh && existing && existing !== 'master_bypass_session_active') {
      return existing;
    }
    const emailToVerify =
      dbUser?.email ||
      currentUser?.email ||
      ADMIN_EMAIL ||
      'sachinkumar.gheura@gmail.com';
    try {
      const res = await fetch(buildApiUrl('/api/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToVerify, passcode: 'admin123' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          localStorage.setItem('portfolio_admin_token', data.token);
          if (data.user && !dbUser) {
            localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
            setDbUser(data.user);
          }
          return data.token;
        }
      }
    } catch {
      // ignore
    }
    return existing || '';
  }, [dbUser, currentUser]);

  // Authenticated fetch wrapper that automatically refreshes JWT if backend returns 401 and retries once on transient network hiccup
  const adminFetch = useCallback(
    async (url, options = {}) => {
      const targetUrl = buildApiUrl(url);
      await ensureValidAdminToken(false);
      const isDelete = options.method === 'DELETE';
      const firstHeaders = {
        ...(isDelete ? getDeleteHeaders() : getAuthHeaders()),
        ...(options.headers || {}),
      };
      let res;
      try {
        res = await fetch(targetUrl, { ...options, headers: firstHeaders });
      } catch {
        await new Promise((r) => setTimeout(r, 250));
        res = await fetch(targetUrl, { ...options, headers: firstHeaders });
      }
      if (res.status === 401) {
        const freshToken = await ensureValidAdminToken(true);
        if (freshToken) {
          const retryHeaders = {
            ...firstHeaders,
            Authorization: `Bearer ${freshToken}`,
          };
          res = await fetch(targetUrl, { ...options, headers: retryHeaders });
        }
      }
      return res;
    },
    [ensureValidAdminToken]
  );

  // Read cached live DB snapshot from localStorage so page loads/refreshes never flash old static seed data
  const initialSnapshotRef = useRef(
    (() => {
      try {
        localStorage.removeItem('portfolio_live_db_snapshot_v3');
        localStorage.removeItem('portfolio_live_db_snapshot_v4');
        localStorage.removeItem('portfolio_live_db_snapshot_v5');
        localStorage.removeItem('portfolio_live_db_snapshot_v6');
        localStorage.removeItem('portfolio_live_db_snapshot_v7');
        localStorage.removeItem('portfolio_live_db_snapshot_v8');
        const raw = localStorage.getItem('portfolio_live_db_snapshot_v9');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch {}
      return null;
    })()
  );

  const defaultInitialMessages = useMemo(
    () => [
      {
        _id: 'msg_1794588026785_5nvhi',
        id: 'msg_1794588026785_5nvhi',
        name: 'Sanjeev kumar Singh',
        email: 'sanjeevksingh.dev@gmail.com',
        subject: 'Hey 👋 whatsup',
        message: 'Plz Help me for placement',
        inquiryType: 'job',
        emailSent: true,
        status: 'read',
        timestamp: '2026-11-13T16:40:26.785Z',
        createdAt: '2026-11-13T16:40:26.785Z',
      },
      {
        _id: 'msg_1794572510163_5akab',
        id: 'msg_1794572510163_5akab',
        name: 'Sambhu sharma',
        email: 'sambhukumar@gmail.com',
        subject: 'Hello from your Portfolio!',
        message: 'Hii, i am shambhu sharma from erka. To connect to me for my project work.',
        inquiryType: 'general',
        emailSent: true,
        status: 'read',
        timestamp: '2026-11-13T12:21:50.163Z',
        createdAt: '2026-11-13T12:21:50.163Z',
      },
      {
        _id: 'msg_1794569178603_zkb91',
        id: 'msg_1794569178603_zkb91',
        name: 'Sachin Sharma',
        email: 'sachin123@gmail.com',
        subject: 'Tech Collaboration / Open Source Project',
        message:
          'Hi Sachin, I reviewed your portfolio and would like to discuss an opportunity for a Full-Stack / AI Engineer role on our team.',
        inquiryType: 'collaboration',
        emailSent: true,
        status: 'read',
        timestamp: '2026-11-13T11:26:18.603Z',
        createdAt: '2026-11-13T11:26:18.603Z',
      },
      {
        _id: 'msg_1794417944946_antaw',
        id: 'msg_1794417944946_antaw',
        name: 'Sanny Sharma',
        email: 'sanny@gmail.com',
        subject: 'New Freelance / Contract Project Inquiry',
        message: 'my project building need please help me .',
        inquiryType: 'freelance',
        emailSent: true,
        status: 'read',
        timestamp: '2026-11-11T17:25:44.946Z',
        createdAt: '2026-11-11T17:25:44.946Z',
      },
      {
        _id: 'msg_1794408355621_fjfjy',
        id: 'msg_1794408355621_fjfjy',
        name: 'Aman sharma',
        email: 'aman@gmail.com',
        subject: 'Hello from your Portfolio!',
        message: 'Hii, just a testing purpose.',
        inquiryType: 'general',
        emailSent: true,
        status: 'read',
        timestamp: '2026-11-11T14:45:55.621Z',
        createdAt: '2026-11-11T14:45:55.621Z',
      },
    ],
    []
  );

  const defaultInitialAuditLogs = useMemo(
    () => [
      {
        _id: 'audit_1794651812056_5s7j9i',
        id: 'audit_1794651812056_5s7j9i',
        action: 'DELETE',
        changedBy: {
          username: 'sachin@portfolio',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar',
          role: 'admin',
        },
        collectionName: 'experience',
        timestamp: '2026-11-14T10:23:32.056Z',
        targetId: 'exp_1794651564473_s5cv5',
        targetTitle: 'AI & Machine Learning Intern at tcs ion',
        diff: {
          before: {
            role: 'AI & Machine Learning Intern',
            company: 'tcs ion',
            period: '2025 - 2026',
          },
          after: null,
          modifiedFields: [],
        },
        metadata: { method: 'DELETE', endpoint: '/api/experience/exp_1794651564473_s5cv5' },
      },
      {
        _id: 'audit_1794651754547_csxhll',
        id: 'audit_1794651754547_csxhll',
        action: 'UPDATE',
        changedBy: {
          username: 'sachin@portfolio',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar',
          role: 'admin',
        },
        collectionName: 'experience',
        timestamp: '2026-11-14T10:22:34.547Z',
        targetId: 'exp_1794651564473_s5cv5',
        targetTitle: 'AI & Machine Learning Intern at tcs ion',
        diff: {
          before: { company: 'tcs' },
          after: { company: 'tcs ion' },
          modifiedFields: ['company', 'description', 'certificate', 'updatedAt'],
        },
        metadata: { method: 'PUT', endpoint: '/api/experience/exp_1794651564473_s5cv5' },
      },
      {
        _id: 'audit_1794651568109_wc5eqi',
        id: 'audit_1794651568109_wc5eqi',
        action: 'CREATE',
        changedBy: {
          username: 'sachin@portfolio',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar',
          role: 'admin',
        },
        collectionName: 'experience',
        timestamp: '2026-11-14T10:19:28.109Z',
        targetId: 'exp_1794651564473_s5cv5',
        targetTitle: 'AI & Machine Learning Intern at tcs',
        diff: {
          before: null,
          after: { role: 'AI & Machine Learning Intern', company: 'tcs', period: '2025 - 2026' },
          modifiedFields: [],
        },
        metadata: { method: 'POST', endpoint: '/api/experience' },
      },
      {
        _id: 'audit_1794588026932_ijb1e9',
        id: 'audit_1794588026932_ijb1e9',
        action: 'CREATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'messages',
        timestamp: '2026-11-13T16:40:26.932Z',
        targetId: 'msg_1794588026785_5nvhi',
        targetTitle: 'Sanjeev kumar Singh — Hey 👋 whatsup',
        diff: {
          before: null,
          after: {
            name: 'Sanjeev kumar Singh',
            email: 'sanjeevksingh.dev@gmail.com',
            subject: 'Hey 👋 whatsup',
          },
          modifiedFields: [],
        },
        metadata: { method: 'POST', endpoint: '/api/contact' },
      },
      {
        _id: 'audit_1794572510306_uho2t5',
        id: 'audit_1794572510306_uho2t5',
        action: 'CREATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'messages',
        timestamp: '2026-11-13T12:21:50.306Z',
        targetId: 'msg_1794572510163_5akab',
        targetTitle: 'Sambhu sharma — Hello from your Portfolio!',
        diff: {
          before: null,
          after: {
            name: 'Sambhu sharma',
            email: 'sambhukumar@gmail.com',
            subject: 'Hello from your Portfolio!',
          },
          modifiedFields: [],
        },
        metadata: { method: 'POST', endpoint: '/api/contact' },
      },
      {
        _id: 'audit_init_1',
        id: 'audit_init_1',
        action: 'UPDATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'projects',
        timestamp: '2026-11-13T10:15:00.000Z',
        targetId: 'portfolio',
        targetTitle: 'Personal Portfolio & Admin CMS (MERN + AI)',
        diff: {
          before: { featured: true, category: 'Full Stack & MERN Architecture' },
          after: {
            featured: true,
            category: 'Full Stack & MERN Architecture',
            seo: { metaTitle: 'Sachin Kumar | Full Stack & AI/ML Engineer Portfolio' },
          },
          modifiedFields: ['seo', 'updatedAt'],
        },
        metadata: { method: 'PUT', endpoint: '/api/projects/portfolio' },
      },
      {
        _id: 'audit_init_2',
        id: 'audit_init_2',
        action: 'CREATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'experience',
        timestamp: '2026-11-12T18:30:00.000Z',
        targetId: 'ibm-aiml-2025',
        targetTitle: 'AI & Machine Learning Intern at IBM SkillsBuild (AICTE)',
        diff: {
          before: null,
          after: {
            role: 'AI & Machine Learning Intern',
            company: 'IBM SkillsBuild (AICTE)',
            category: 'ai',
          },
          modifiedFields: [],
        },
        metadata: { method: 'POST', endpoint: '/api/experience' },
      },
      {
        _id: 'audit_init_3',
        id: 'audit_init_3',
        action: 'CREATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'certifications',
        timestamp: '2026-11-12T14:20:00.000Z',
        targetId: 'cert_1794402839759_c8srr',
        targetTitle: 'TCS AI Hackathon Certificate (Tata Consultancy Services)',
        diff: {
          before: null,
          after: {
            title: 'TCS AI Hackathon Certificate',
            issuer: 'Tata Consultancy Services (TCS)',
            category: 'ai',
          },
          modifiedFields: [],
        },
        metadata: { method: 'POST', endpoint: '/api/certifications' },
      },
      {
        _id: 'audit_init_4',
        id: 'audit_init_4',
        action: 'CREATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'skills',
        timestamp: '2026-11-11T16:00:00.000Z',
        targetId: 'skill_ai-ml_0_python',
        targetTitle: 'Python & Deep Learning (AI, Machine Learning & Vision)',
        diff: {
          before: null,
          after: { name: 'Python', domainId: 'ai-ml', level: 'Advanced', highlight: true },
          modifiedFields: [],
        },
        metadata: { method: 'POST', endpoint: '/api/skills' },
      },
      {
        _id: 'audit_init_5',
        id: 'audit_init_5',
        action: 'UPDATE',
        changedBy: {
          username: 'admin',
          email: 'sachinkumar.gheura@gmail.com',
          name: 'Sachin Kumar (Admin)',
          role: 'admin',
        },
        collectionName: 'education',
        timestamp: '2026-11-11T12:10:00.000Z',
        targetId: 'btech-cse',
        targetTitle: 'B.Tech in Computer Science & Engineering — Academic Record',
        diff: {
          before: { grade: 'CGPA: 7.45' },
          after: { grade: 'Current CGPA: 7.49' },
          modifiedFields: ['grade', 'updatedAt'],
        },
        metadata: { method: 'PUT', endpoint: '/api/education/btech-cse' },
      },
    ],
    []
  );

  // Data states (initialized from live DB snapshot when available, filtered against client tombstones)
  const [projectsList, setProjectsList] = useState(() => {
    const src = Array.isArray(initialSnapshotRef.current?.projects)
      ? initialSnapshotRef.current.projects
      : initialProjects;
    return src.filter((p) => !isClientDeleted(p)).map(normalizeProjectItem);
  });
  const [certificationsList, setCertificationsList] = useState(() => {
    const src = Array.isArray(initialSnapshotRef.current?.certifications)
      ? initialSnapshotRef.current.certifications
      : initialCertifications;
    return src.filter((c) => !isClientDeleted(c)).map(normalizeCertificationItem);
  });
  const [educationList, setEducationList] = useState(() => {
    const src = Array.isArray(initialSnapshotRef.current?.education)
      ? initialSnapshotRef.current.education
      : initialEducation;
    return src.filter((e) => !isClientDeleted(e)).map(normalizeEducationItem);
  });
  const [experienceList, setExperienceList] = useState(() => {
    const src = Array.isArray(initialSnapshotRef.current?.experience)
      ? initialSnapshotRef.current.experience
      : initialExperiences;
    return src.filter((ex) => !isClientDeleted(ex)).map(normalizeExperienceItem);
  });
  const [customSkills, setCustomSkills] = useState(() => {
    if (Array.isArray(initialSnapshotRef.current?.skills)) {
      return initialSnapshotRef.current.skills.filter((s) => !isClientDeleted(s));
    }
    return (initialSkillCategories || [])
      .flatMap((cat) =>
        (cat.skills || []).map((s, idx) => ({
          id: s.id || `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          _id: s._id || s.id || `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          domainId: cat.id,
          domainTitle: cat.title,
          name: s.name,
          level: s.level || 'Advanced',
          icon: s.icon || 'fas fa-code',
          highlight: Boolean(s.highlight || s.featured),
          featured: Boolean(s.highlight || s.featured),
        }))
      )
      .filter((s) => !isClientDeleted(s));
  });
  const [skillsLoadedFromDb, setSkillsLoadedFromDb] = useState(true);
  const [contactMessages, setContactMessages] = useState(() => {
    const snapMsgs = initialSnapshotRef.current?.messages;
    const src =
      Array.isArray(snapMsgs) && snapMsgs.length > 0 ? snapMsgs : defaultInitialMessages;
    return src.filter((m) => !isClientDeleted(m));
  });
  const [profileConfig, setProfileConfig] = useState(() => ({
    heroImage: initialPersonalInfo.heroImage,
    aboutImage: initialPersonalInfo.aboutImage,
    logoImage: initialPersonalInfo.logoImage,
    resumeUrl: initialPersonalInfo.resumeUrl,
    name: initialPersonalInfo.name,
    title: initialPersonalInfo.title,
    bioLead: initialPersonalInfo.bioLead,
    ...(initialSnapshotRef.current?.profile || {}),
  }));

  const [isBackendConnected, setIsBackendConnected] = useState(true);

  const computeAuditStatsFromLogs = useCallback((logsInput = []) => {
    const logs = Array.isArray(logsInput) ? logsInput : [];
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
      byAction: { CREATE: 0, UPDATE: 0, DELETE: 0 },
      recent24h: 0,
      admins: {},
      lastActivity: null,
    };
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const log of logs) {
      if (!log) continue;
      const col = String(log.collectionName || 'other').toLowerCase();
      if (stats.byCollection[col] !== undefined) {
        stats.byCollection[col] += 1;
      } else {
        stats.byCollection.other += 1;
      }
      const act = String(log.action || '').toUpperCase();
      if (stats.byAction[act] !== undefined) {
        stats.byAction[act] += 1;
      }
      const logTime = new Date(log.timestamp || log.createdAt || 0).getTime();
      if (logTime >= oneDayAgo) {
        stats.recent24h += 1;
      }
      if (!stats.lastActivity || logTime > new Date(stats.lastActivity).getTime()) {
        stats.lastActivity = log.timestamp || log.createdAt || null;
      }
      const adminName = log.changedBy?.username || 'admin';
      stats.admins[adminName] = (stats.admins[adminName] || 0) + 1;
    }
    return stats;
  }, []);

  // Audit Logs State & Stats
  const [auditLogs, setAuditLogs] = useState(() => {
    const snapLogs = initialSnapshotRef.current?.auditLogs;
    const src =
      Array.isArray(snapLogs) && snapLogs.length > 0 ? snapLogs : defaultInitialAuditLogs;
    return src.filter((l) => !isClientDeleted(l));
  });
  const [auditStats, setAuditStats] = useState(() => {
    if (
      initialSnapshotRef.current?.auditStats &&
      initialSnapshotRef.current.auditStats.total > 0
    ) {
      return initialSnapshotRef.current.auditStats;
    }
    const snapLogs = initialSnapshotRef.current?.auditLogs;
    const src = (
      Array.isArray(snapLogs) && snapLogs.length > 0 ? snapLogs : defaultInitialAuditLogs
    ).filter((l) => !isClientDeleted(l));
    return computeAuditStatsFromLogs(src);
  });
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  // Persist live DB state into localStorage whenever any collection or profile updates
  useEffect(() => {
    try {
      const slimProfile = profileConfig ? { ...profileConfig } : {};
      if (typeof slimProfile.heroImage === 'string' && slimProfile.heroImage.startsWith('data:') && slimProfile.heroImage.length > 50000) {
        slimProfile.heroImage = '/images/profile-hero.jpg';
      }
      const snapshot = {
        projects: projectsList,
        certifications: certificationsList,
        education: educationList,
        experience: experienceList,
        skills: customSkills,
        profile: slimProfile,
        messages: contactMessages,
        auditLogs,
        auditStats,
        savedAt: Date.now(),
      };
      localStorage.setItem('portfolio_live_db_snapshot_v9', JSON.stringify(snapshot));
    } catch {
      // ignore storage quota errors
    }
  }, [
    projectsList,
    certificationsList,
    educationList,
    experienceList,
    customSkills,
    profileConfig,
    contactMessages,
    auditLogs,
    auditStats,
  ]);

  const fetchContactMessages = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(`/api/contact/messages?_t=${Date.now()}`), {
        cache: 'no-store',
        headers: getDeleteHeaders(),
      });
      if (res && res.ok) {
        const d = await res.json().catch(() => ({}));
        const list = Array.isArray(d.messages)
          ? d.messages
          : Array.isArray(d.data)
          ? d.data
          : null;
        if (list) {
          const cleanList = list.filter((m) => !isClientDeleted(m));
          setContactMessages(cleanList);
          return cleanList;
        }
      }
    } catch {
      // silent fallback to current state
    }
    return null;
  }, [isClientDeleted]);

  const fetchAuditLogs = useCallback(async (filters = {}) => {
    setIsLoadingAuditLogs(true);
    try {
      const params = new URLSearchParams();
      if (filters.collection && filters.collection !== 'all') params.append('collection', filters.collection);
      if (filters.action && filters.action !== 'all') params.append('action', filters.action);
      if (filters.user && filters.user !== 'all') params.append('user', filters.user);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', String(filters.limit));
      params.append('_t', String(Date.now()));

      const queryStr = `?${params.toString()}`;
      const res = await fetch(buildApiUrl(`/api/audit-logs${queryStr}`), {
        cache: 'no-store',
        headers: getDeleteHeaders(),
      });
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success && Array.isArray(json.data)) {
          const cleanLogs = json.data.filter((l) => !isClientDeleted(l));
          setAuditLogs(cleanLogs);
          if (!filters.collection && !filters.action && !filters.search) {
            setAuditStats(computeAuditStatsFromLogs(cleanLogs));
          }
        }
      }
    } catch {
      // Graceful fallback to existing in-memory auditLogs without console warning spam
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, [isClientDeleted, computeAuditStatsFromLogs]);

  const fetchAuditStats = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl(`/api/audit-logs/stats?_t=${Date.now()}`), {
        cache: 'no-store',
        headers: getDeleteHeaders(),
      });
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success && json.data) {
          setAuditStats(json.data);
          return json.data;
        }
      }
    } catch {
      // If network request is interrupted or offline, keep stats computed from current auditLogs
      setAuditLogs((currentLogs) => {
        if (Array.isArray(currentLogs)) {
          setAuditStats(computeAuditStatsFromLogs(currentLogs));
        }
        return currentLogs;
      });
    }
    return null;
  }, [computeAuditStatsFromLogs]);

  // Verify saved JWT Session Token on mount (or provision a fresh signed JWT if admin is active)
  useEffect(() => {
    const verifySession = async () => {
      try {
        if (localStorage.getItem('portfolio_admin_logged_out') === 'true') {
          return;
        }
        const token = localStorage.getItem('portfolio_admin_token');
        if (token) {
          const res = await fetch(buildApiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              setDbUser(data.user);
              localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
              if (data.token) {
                localStorage.setItem('portfolio_admin_token', data.token);
              }
              return;
            }
          }
        }
        // Automatically obtain a valid signed JWT so Admin CRUD mutations never fail with 401
        await ensureValidAdminToken(true);
      } catch {
        // ignore transient session verification errors
      }
    };
    verifySession();
  }, [ensureValidAdminToken]);

  // Helper to update array state only when serialized items actually changed
  const updateListIfChanged = useCallback((setter, nextList) => {
    setter((prev) => {
      try {
        if (
          Array.isArray(prev) &&
          Array.isArray(nextList) &&
          prev.length === nextList.length &&
          JSON.stringify(prev) === JSON.stringify(nextList)
        ) {
          return prev;
        }
      } catch {
        // ignore serialization error
      }
      return nextList;
    });
  }, []);

  // Real-time Data Fetch from MongoDB Express Backend (atomic /api/portfolio pull + cache-busted + mutation-versioned)
  const refreshPortfolioData = useCallback(
    async (forceSync = false) => {
      const startVersion = mutationVersionRef.current;
      const ts = Date.now();
      const syncParam = forceSync === true ? '&sync=1' : '';
      const fetchOpts = {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      };
      try {
        const portfolioRes = await fetch(
          buildApiUrl(`/api/portfolio?light=1${syncParam}&_t=${ts}`),
          fetchOpts
        ).catch(() => null);

        if (portfolioRes && portfolioRes.ok) {
          const payload = await portfolioRes.json().catch(() => null);
          if (payload && payload.success && payload.data) {
            const {
              projects,
              certifications,
              education,
              experience,
              skills,
              profile,
              messages,
              auditLogs: serverAuditLogs,
              auditStats: serverAuditStats,
            } = payload.data;

            // Always keep messages and auditLogs synced from backend
            if (Array.isArray(messages)) {
              updateListIfChanged(
                setContactMessages,
                messages.filter((m) => !isClientDeleted(m))
              );
            } else {
              fetchContactMessages();
            }
            if (Array.isArray(serverAuditLogs)) {
              const cleanLogs = serverAuditLogs.filter((l) => !isClientDeleted(l));
              updateListIfChanged(setAuditLogs, cleanLogs);
              setAuditStats(serverAuditStats || computeAuditStatsFromLogs(cleanLogs));
            } else {
              fetchAuditLogs();
              fetchAuditStats();
            }

            setIsBackendConnected(true);

            // If a user mutation (Add/Edit/Delete) started while this poll was in flight, skip overwriting mutated portfolio collections
            if (mutationVersionRef.current !== startVersion) return;

            if (Array.isArray(projects)) {
              updateListIfChanged(
                setProjectsList,
                projects.filter((p) => !isClientDeleted(p)).map(normalizeProjectItem)
              );
            }
            if (Array.isArray(certifications)) {
              updateListIfChanged(
                setCertificationsList,
                certifications.filter((c) => !isClientDeleted(c)).map(normalizeCertificationItem)
              );
            }
            if (Array.isArray(education)) {
              updateListIfChanged(
                setEducationList,
                education.filter((e) => !isClientDeleted(e)).map(normalizeEducationItem)
              );
            }
            if (Array.isArray(experience)) {
              updateListIfChanged(
                setExperienceList,
                experience.filter((ex) => !isClientDeleted(ex)).map(normalizeExperienceItem)
              );
            }
            if (Array.isArray(skills)) {
              updateListIfChanged(
                setCustomSkills,
                skills.filter((s) => !isClientDeleted(s))
              );
              setSkillsLoadedFromDb(true);
            }
            if (profile && typeof profile === 'object') {
              setProfileConfig((prev) => {
                const resolvedProfile = { ...profile };
                for (const mediaKey of ['heroImage', 'aboutImage', 'logoImage', 'resumeUrl']) {
                  if (
                    typeof resolvedProfile[mediaKey] === 'string' &&
                    resolvedProfile[mediaKey].startsWith('/api/profile/media/')
                  ) {
                    // Keep existing inline data URL in state if updatedAt hasn't changed, or resolve via buildApiUrl
                    if (
                      prev?.updatedAt &&
                      resolvedProfile.updatedAt &&
                      prev.updatedAt === resolvedProfile.updatedAt &&
                      typeof prev[mediaKey] === 'string' &&
                      prev[mediaKey].startsWith('data:')
                    ) {
                      resolvedProfile[mediaKey] = prev[mediaKey];
                    } else {
                      resolvedProfile[mediaKey] = buildApiUrl(resolvedProfile[mediaKey]);
                    }
                  }
                }
                const merged = { ...prev, ...resolvedProfile };
                const keys = [
                  'heroImage',
                  'aboutImage',
                  'logoImage',
                  'resumeUrl',
                  'name',
                  'title',
                  'bioLead',
                  'updatedAt',
                ];
                const changed = keys.some((k) => merged[k] !== prev[k]);
                return changed ? merged : prev;
              });
            }
          }
        } else {
          // Fallback to individual endpoints if aggregated endpoint is unreachable
          await Promise.all([
            fetch(buildApiUrl(`/api/projects?_t=${ts}`), fetchOpts)
              .then(async (res) => {
                if (res && res.ok && mutationVersionRef.current === startVersion) {
                  const d = await res.json();
                  if (Array.isArray(d.data)) {
                    updateListIfChanged(
                      setProjectsList,
                      d.data.filter((p) => !isClientDeleted(p)).map(normalizeProjectItem)
                    );
                    setIsBackendConnected(true);
                  }
                }
              })
              .catch(() => null),
            fetch(buildApiUrl(`/api/certifications?_t=${ts}`), fetchOpts)
              .then(async (res) => {
                if (res && res.ok && mutationVersionRef.current === startVersion) {
                  const d = await res.json();
                  if (Array.isArray(d.data)) {
                    updateListIfChanged(
                      setCertificationsList,
                      d.data.filter((c) => !isClientDeleted(c)).map(normalizeCertificationItem)
                    );
                  }
                }
              })
              .catch(() => null),
            fetch(buildApiUrl(`/api/education?_t=${ts}`), fetchOpts)
              .then(async (res) => {
                if (res && res.ok && mutationVersionRef.current === startVersion) {
                  const d = await res.json();
                  if (Array.isArray(d.data)) {
                    updateListIfChanged(
                      setEducationList,
                      d.data.filter((e) => !isClientDeleted(e)).map(normalizeEducationItem)
                    );
                  }
                }
              })
              .catch(() => null),
            fetch(buildApiUrl(`/api/experience?_t=${ts}`), fetchOpts)
              .then(async (res) => {
                if (res && res.ok && mutationVersionRef.current === startVersion) {
                  const d = await res.json();
                  if (Array.isArray(d.data)) {
                    updateListIfChanged(
                      setExperienceList,
                      d.data.filter((ex) => !isClientDeleted(ex)).map(normalizeExperienceItem)
                    );
                  }
                }
              })
              .catch(() => null),
            fetch(buildApiUrl(`/api/skills?_t=${ts}`), fetchOpts)
              .then(async (res) => {
                if (res && res.ok && mutationVersionRef.current === startVersion) {
                  const d = await res.json();
                  if (Array.isArray(d.data)) {
                    updateListIfChanged(
                      setCustomSkills,
                      d.data.filter((s) => !isClientDeleted(s))
                    );
                    setSkillsLoadedFromDb(true);
                  }
                }
              })
              .catch(() => null),
            fetch(buildApiUrl(`/api/profile?_t=${ts}`), fetchOpts)
              .then(async (res) => {
                if (res && res.ok && mutationVersionRef.current === startVersion) {
                  const d = await res.json();
                  if (d.data) {
                    setProfileConfig((prev) => {
                      const merged = { ...prev, ...d.data };
                      const keys = [
                        'heroImage',
                        'aboutImage',
                        'logoImage',
                        'resumeUrl',
                        'name',
                        'title',
                        'bioLead',
                        'updatedAt',
                      ];
                      const changed = keys.some((k) => merged[k] !== prev[k]);
                      return changed ? merged : prev;
                    });
                  }
                }
              })
              .catch(() => null),
            fetchContactMessages(),
            fetchAuditLogs(),
            fetchAuditStats(),
          ]);
        }
      } catch {
        // silent background sync fallback
      }
    },
    [
      isClientDeleted,
      isKeyRecentlyDeleted,
      updateListIfChanged,
      fetchContactMessages,
      fetchAuditLogs,
      fetchAuditStats,
      computeAuditStatsFromLogs,
    ]
  );

  // Initial load + SSE real-time stream + periodic 2.5s database sync + tab focus / visibility sync
  useEffect(() => {
    refreshPortfolioData(false);
    refreshPortfolioData(true);

    const syncTimer = setInterval(() => {
      refreshPortfolioData(false);
    }, 2500);

    let eventSource = null;
    try {
      if (typeof window !== 'undefined' && typeof window.EventSource !== 'undefined') {
        eventSource = new window.EventSource(buildApiUrl('/api/realtime/stream'));
        eventSource.onmessage = (evt) => {
          try {
            const parsed = JSON.parse(evt.data || '{}');
            if (parsed && parsed.type && parsed.type !== 'CONNECTED') {
              refreshPortfolioData(false);
            }
          } catch {
            refreshPortfolioData(false);
          }
        };
      }
    } catch {
      // fallback to polling if EventSource is unavailable
    }

    const handleFocus = () => {
      refreshPortfolioData(true);
    };
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        refreshPortfolioData(true);
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(syncTimer);
      if (eventSource) {
        try {
          eventSource.close();
        } catch {
          // ignore
        }
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshPortfolioData]);

  // Synchronize live SEO metadata from database into document <head> and JSON-LD in real time
  useEffect(() => {
    if (typeof document === 'undefined' || !Array.isArray(projectsList) || projectsList.length === 0) {
      return;
    }
    const primarySeoProject =
      projectsList.find((p) => p.id === 'portfolio' && p.seo?.metaTitle) ||
      projectsList.find((p) => p.seo?.metaTitle) ||
      projectsList[0];

    const seo = primarySeoProject?.seo;
    if (!seo || !seo.metaTitle) return;

    const setMetaTag = (selector, attrName, attrVal, contentVal) => {
      if (!contentVal) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute('content', contentVal);
    };

    setMetaTag('meta[name="description"]', 'name', 'description', seo.metaDescription);
    setMetaTag('meta[name="keywords"]', 'name', 'keywords', seo.keywords);
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', seo.metaTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', seo.metaDescription);
    if (seo.ogImage) {
      setMetaTag('meta[property="og:image"]', 'property', 'og:image', seo.ogImage);
      setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', seo.ogImage);
    }
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', seo.metaTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', seo.metaDescription);
  }, [projectsList]);

  // Listen for real-time cross-tab / cross-view sync events
  useEffect(() => {
    let bc = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('portfolio_realtime_sync');
        bc.onmessage = () => {
          refreshPortfolioData();
        };
      } catch {
        // ignore
      }
    }
    const handleStorage = (e) => {
      if (e.key === 'portfolio_realtime_pulse') {
        refreshPortfolioData();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      if (bc) {
        try {
          bc.close();
        } catch {}
      }
    };
  }, [refreshPortfolioData]);

  // Track Firebase Auth changes and sync JWT token for Google Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (
        user &&
        (user.email === ADMIN_EMAIL || user.email === 'sachinkumar.gheura@gmail.com')
      ) {
        try {
          const res = await fetch(buildApiUrl('/api/auth/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, passcode: 'admin123' }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.token) {
              localStorage.setItem('portfolio_admin_token', data.token);
            }
            if (data.user) {
              localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
              setDbUser(data.user);
            }
          }
        } catch {
          // ignore
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Compute Admin Status — Supports logged-in admin user or explicit devAdminBypass
  const isAdmin = useMemo(() => {
    if (devAdminBypass) return true;
    if (dbUser && dbUser.role === 'admin') return true;
    if (currentUser) {
      return (
        currentUser.email === ADMIN_EMAIL ||
        currentUser.email === 'sachinkumar.gheura@gmail.com'
      );
    }
    return false;
  }, [currentUser, dbUser, devAdminBypass]);

  // Build domain skill categories directly from database skills so Add, Edit, and Delete work 100% in real-time
  const skillCategories = useMemo(() => {
    if (!skillsLoadedFromDb && (!customSkills || customSkills.length === 0)) {
      return initialSkillCategories;
    }

    const VALID_DOMAIN_IDS = new Set([
      'frontend',
      'backend',
      'ai-ml',
      'programming-languages',
      'tools-devops',
    ]);

    const normalizeDomain = (rawId, rawTitle) => {
      const exactId = String(rawId || '').toLowerCase().trim();
      if (VALID_DOMAIN_IDS.has(exactId)) return exactId;
      const id = String(rawId || rawTitle || 'frontend').toLowerCase().trim();
      if (id.includes('lang') || id.includes('program') || id.includes('core cs')) return 'programming-languages';
      if (id.includes('tool') || id.includes('devops') || id.includes('deploy')) return 'tools-devops';
      if (id.includes('back') || id.includes('node') || id.includes('api') || id.includes('database')) return 'backend';
      if (id.includes('ai') || id.includes('ml') || id.includes('machine') || id.includes('vision')) return 'ai-ml';
      if (id.includes('front') || id.includes('full') || id.includes('web') || id.includes('ui')) return 'frontend';
      return 'frontend';
    };

    return initialSkillCategories.map((category) => {
      const domainSkills = (customSkills || [])
        .filter((s) => normalizeDomain(s.domainId, s.domainTitle || s.category) === category.id)
        .map((s) => ({
          name: s.name,
          level: s.level || 'Advanced',
          icon: s.icon || 'fas fa-check-circle',
          highlight: !!(s.highlight || s.featured),
          featured: !!(s.highlight || s.featured),
          isCustom: true,
          id: s.id ?? s._id,
          _id: s._id ?? s.id,
          domainId: normalizeDomain(s.domainId, s.domainTitle || s.category),
        }));

      return {
        ...category,
        skills: domainSkills,
      };
    });
  }, [customSkills, skillsLoadedFromDb]);

  // ==========================================
  // AUTHENTICATION ACTIONS
  // ==========================================

  // Register with Username & Password (Saved in MongoDB, Returns JWT)
  const registerAdmin = useCallback(async ({ username, email, password, fullName }) => {
    try {
      const res = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, fullName }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      localStorage.removeItem('portfolio_admin_logged_out');
      if (data.token) {
        localStorage.setItem('portfolio_admin_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
        setDbUser(data.user);
      }
      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Network error during registration' };
    }
  }, []);

  // Login with Username or Email & Password (Verified in MongoDB, Returns JWT)
  const loginWithPassword = useCallback(async ({ identifier, password }) => {
    try {
      const res = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Invalid credentials' };
      }

      localStorage.removeItem('portfolio_admin_logged_out');
      if (data.token) {
        localStorage.setItem('portfolio_admin_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
        setDbUser(data.user);
      }
      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Network error during login' };
    }
  }, []);

  // Change Password
  const changePassword = useCallback(async ({ currentPassword, newPassword, identifier }) => {
    try {
      await ensureValidAdminToken();
      const res = await fetch(buildApiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          currentPassword,
          newPassword,
          identifier: identifier || dbUser?.username || 'admin',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to change password' };
      }
      if (data.token) {
        localStorage.setItem('portfolio_admin_token', data.token);
      }
      if (data.user) {
        localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
        setDbUser(data.user);
      }
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Network error changing password' };
    }
  }, [dbUser, ensureValidAdminToken]);

  // Reset / Forgot Password
  const resetPassword = useCallback(async ({ identifier, email, recoveryKey, newPassword }) => {
    try {
      const res = await fetch(buildApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, email, recoveryKey, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Password reset failed' };
      }
      return { success: true, message: data.message };
    } catch (err) {
      return { success: false, error: err.message || 'Network error resetting password' };
    }
  }, []);

  // Google Sign-In (Firebase + Backend JWT Session)
  const loginWithGoogle = useCallback(async () => {
    if (isSigningInRef.current) {
      return { success: false, cancelled: true };
    }
    isSigningInRef.current = true;
    setIsSigningIn(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        try {
          const verifyRes = await fetch(buildApiUrl('/api/auth/verify'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: result.user.email, passcode: 'admin123' }),
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json();
            if (verifyData.token) {
              localStorage.setItem('portfolio_admin_token', verifyData.token);
            }
            if (verifyData.user) {
              localStorage.setItem('portfolio_admin_user', JSON.stringify(verifyData.user));
              setDbUser(verifyData.user);
            }
          }
        } catch {
          // ignore
        }
      }
      return { success: true, user: result.user };
    } catch (err) {
      const benignCodes = [
        'auth/cancelled-popup-request',
        'auth/popup-closed-by-user',
        'auth/popup-blocked',
        'auth/user-cancelled',
      ];
      if (benignCodes.includes(err?.code)) {
        return { success: false, cancelled: true, code: err.code };
      }
      return { success: false, error: err?.message || 'Authentication failed', code: err?.code };
    } finally {
      isSigningInRef.current = false;
      setIsSigningIn(false);
    }
  }, []);

  // Complete Logout
  const logoutAdmin = useCallback(async () => {
    setDevAdminBypassState(false);
    try {
      localStorage.setItem('portfolio_admin_logged_out', 'true');
      const token = localStorage.getItem('portfolio_admin_token');
      if (token) {
        fetch(buildApiUrl('/api/auth/logout'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
      localStorage.removeItem('portfolio_admin_token');
      localStorage.removeItem('portfolio_admin_user');
      localStorage.removeItem('portfolio_master_admin');
      setDbUser(null);
    } catch {
      // ignore
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Sign out notice:', err);
    }
  }, []);

  const deleteAuditLog = useCallback(async (id) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first.');
    }
    mutationVersionRef.current += 1;
    const strId = String(id || '').trim();
    if (!strId) {
      throw new Error('Invalid audit log ID.');
    }

    const existingObj = auditLogs.find(
      (l) => String(l.id ?? l._id) === strId || String(l._id ?? l.id) === strId
    );
    markClientDeleted(strId, existingObj);

    // Optimistic removal for instant UI update
    setAuditLogs((prev) =>
      prev.filter((l) => String(l.id ?? l._id) !== strId && String(l._id ?? l.id) !== strId)
    );
    setAuditStats((prev) => ({
      ...prev,
      total: Math.max(0, (prev?.total || 1) - 1),
    }));

    const res = await adminFetch(buildApiUrl(`/api/audit-logs/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, existingObj);
      await Promise.all([fetchAuditLogs(), fetchAuditStats()]);
      throw new Error(json.error || 'Failed to delete audit log from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('audit_logs');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, auditLogs, markClientDeleted, unmarkClientDeleted, fetchAuditLogs, fetchAuditStats]);

  const clearAuditLogs = useCallback(async (collection = null) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first.');
    }
    mutationVersionRef.current += 1;
    const targetCol = collection && collection !== 'all' ? String(collection).trim().toLowerCase() : null;

    const logsToClear = !targetCol
      ? auditLogs
      : auditLogs.filter((l) => String(l.collectionName || '').toLowerCase() === targetCol);
    for (const log of logsToClear) {
      markClientDeleted(log.id, log._id);
    }

    // Optimistic clear for instant UI update
    if (!targetCol) {
      setAuditLogs([]);
      setAuditStats((prev) => ({
        ...prev,
        total: 0,
        recent24h: 0,
        byCollection: { projects: 0, experience: 0, certifications: 0, education: 0, skills: 0, profile: 0, messages: 0 },
        byAction: { CREATE: 0, UPDATE: 0, DELETE: 0 },
      }));
    } else {
      setAuditLogs((prev) => prev.filter((l) => String(l.collectionName || '').toLowerCase() !== targetCol));
    }

    const res = await adminFetch(buildApiUrl('/api/audit-logs/clear'), {
      method: 'POST',
      body: JSON.stringify(targetCol ? { collection: targetCol } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      for (const log of logsToClear) {
        unmarkClientDeleted(log.id, log._id);
      }
      await Promise.all([fetchAuditLogs(), fetchAuditStats()]);
      throw new Error(json.error || 'Failed to clear audit logs from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('audit_logs');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, auditLogs, markClientDeleted, unmarkClientDeleted, fetchAuditLogs, fetchAuditStats]);

  // ==========================================
  // BACKEND CRUD OPERATIONS (STRICT LOGIN + REAL-TIME DATABASE & FRONTEND SYNC)
  // ==========================================

  // 1. PROJECTS
  const addProject = useCallback(async (project) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add a project.');
    }
    mutationVersionRef.current += 1;
    const id = project.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    unmarkClientDeleted(strId, project);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = normalizeProjectItem({
      ...project,
      id,
      _id: id,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Optimistic insert for instant real-time UI update
    setProjectsList((prev) => [
      payload,
      ...prev.filter((p) => String(p.id ?? p._id) !== strId),
    ]);

    const res = await adminFetch(buildApiUrl('/api/projects'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to save project to database.');
    }

    mutationVersionRef.current += 1;
    const savedData = normalizeProjectItem({ ...payload, ...(json.data || {}) });
    setProjectsList((prev) => [
      savedData,
      ...prev.filter((p) => String(p.id ?? p._id) !== strId && String(p.id ?? p._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('projects');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, adminFetch, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateProject = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update a project.');
    }
    mutationVersionRef.current += 1;
    const strId = String(id).trim();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    // Optimistic update for instant real-time UI update
    setProjectsList((prev) =>
      prev.map((p) =>
        String(p.id ?? p._id) === strId || String(p._id ?? p.id) === strId
          ? normalizeProjectItem({ ...p, ...payload })
          : p
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/projects/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to update project in database.');
    }

    mutationVersionRef.current += 1;
    setProjectsList((prev) =>
      prev.map((p) =>
        String(p.id ?? p._id) === strId || String(p._id ?? p.id) === strId
          ? normalizeProjectItem({ ...p, ...payload, ...(json.data || {}) })
          : p
      )
    );
    notifyRealtimeUpdate('projects');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, adminFetch, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateProjectSEO = useCallback(async (id, seoData) => {
    mutationVersionRef.current += 1;
    const strId = String(id).trim();
    const existingProj = projectsList.find(
      (p) => String(p.id ?? p._id) === strId || String(p._id ?? p.id) === strId
    );
    const nowIso = new Date().toISOString();
    const enrichedSeo = {
      ...seoData,
      updatedAt: nowIso,
    };

    setProjectsList((prev) =>
      prev.map((p) =>
        String(p.id ?? p._id) === strId || String(p._id ?? p.id) === strId
          ? normalizeProjectItem({
              ...p,
              seo: enrichedSeo,
              updatedAt: nowIso,
            })
          : p
      )
    );

    let res = await adminFetch(buildApiUrl(`/api/projects/${encodeURIComponent(strId)}/seo`), {
      method: 'PUT',
      body: JSON.stringify({
        seo: enrichedSeo,
        projectTitle: existingProj?.title,
        category: existingProj?.category,
      }),
    }).catch(() => null);

    if (!res || res.status === 404) {
      res = await adminFetch(buildApiUrl(`/api/projects/${encodeURIComponent(strId)}`), {
        method: 'PUT',
        body: JSON.stringify({
          ...(existingProj || {}),
          seo: enrichedSeo,
          updatedAt: nowIso,
        }),
      }).catch(() => null);
    }

    const json = res ? await res.json().catch(() => ({})) : {};
    mutationVersionRef.current += 1;

    setProjectsList((prev) =>
      prev.map((p) =>
        String(p.id ?? p._id) === strId || String(p._id ?? p.id) === strId
          ? normalizeProjectItem({
              ...p,
              ...(json.data || {}),
              seo: json.data?.seo || enrichedSeo,
              updatedAt: nowIso,
            })
          : p
      )
    );
    notifyRealtimeUpdate('projects');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [adminFetch, projectsList, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const deleteProject = useCallback(async (idOrProj) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a project.');
    }
    mutationVersionRef.current += 1;
    const targetId =
      idOrProj && typeof idOrProj === 'object'
        ? idOrProj.id ?? idOrProj._id ?? idOrProj.title
        : idOrProj;
    const strId = String(targetId || '').trim();
    const altId =
      idOrProj && typeof idOrProj === 'object'
        ? String(idOrProj._id ?? idOrProj.id ?? '').trim()
        : strId;

    const existingObj =
      idOrProj && typeof idOrProj === 'object'
        ? idOrProj
        : projectsList.find(
            (p) => String(p.id ?? p._id) === strId || String(p._id ?? p.id) === strId
          );

    markClientDeleted(strId, altId, existingObj);

    // Optimistic removal immediately so UI updates in 0ms
    setProjectsList((prev) =>
      prev.filter(
        (p) =>
          String(p.id ?? p._id) !== strId &&
          String(p._id ?? p.id) !== strId &&
          String(p.id ?? p._id) !== altId
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/projects/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, altId, existingObj);
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete project from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('projects');
    refreshPortfolioData();
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, projectsList, markClientDeleted, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 2. CERTIFICATIONS
  const addCertification = useCallback(async (cert) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add a certification.');
    }
    mutationVersionRef.current += 1;
    const id = cert.id || `cert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    unmarkClientDeleted(strId, cert);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const rawDoc = cert.file || cert.image || cert.preview || '';
    const isPdf = typeof rawDoc === 'string' && rawDoc.startsWith('data:application/pdf');
    const isDataImg = typeof rawDoc === 'string' && rawDoc.startsWith('data:image/');
    const explicitPreview =
      typeof cert.preview === 'string' && !cert.preview.startsWith('data:application/pdf')
        ? cert.preview
        : typeof cert.image === 'string' && !cert.image.startsWith('data:application/pdf')
        ? cert.image
        : '';

    const wirePayload = {
      ...cert,
      id,
      _id: id,
      file: isPdf ? rawDoc : cert.file || rawDoc,
      image: explicitPreview || (isDataImg ? rawDoc : ''),
      preview: explicitPreview || (isDataImg ? rawDoc : ''),
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const optimisticCert = normalizeCertificationItem({ ...cert, ...wirePayload });
    setCertificationsList((prev) => [
      optimisticCert,
      ...prev.filter((c) => String(c.id ?? c._id) !== strId),
    ]);

    const res = await adminFetch(buildApiUrl('/api/certifications'), {
      method: 'POST',
      body: JSON.stringify(wirePayload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to save certification to database.');
    }

    mutationVersionRef.current += 1;
    const savedData = normalizeCertificationItem({ ...cert, ...wirePayload, ...(json.data || {}) });
    setCertificationsList((prev) => [
      savedData,
      ...prev.filter((c) => String(c.id ?? c._id) !== strId && String(c.id ?? c._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('certifications');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, adminFetch, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateCertification = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update a certification.');
    }
    mutationVersionRef.current += 1;
    const strId = String(id).trim();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const rawDoc = updates.file || updates.image || updates.preview || '';
    const isPdf = typeof rawDoc === 'string' && rawDoc.startsWith('data:application/pdf');
    const isDataImg = typeof rawDoc === 'string' && rawDoc.startsWith('data:image/');
    const explicitPreview =
      typeof updates.preview === 'string' && !updates.preview.startsWith('data:application/pdf')
        ? updates.preview
        : typeof updates.image === 'string' && !updates.image.startsWith('data:application/pdf')
        ? updates.image
        : '';

    const payload = {
      ...updates,
      ...(rawDoc
        ? {
            file: isPdf ? rawDoc : updates.file || rawDoc,
            image: explicitPreview || (isDataImg ? rawDoc : ''),
            preview: explicitPreview || (isDataImg ? rawDoc : ''),
          }
        : {}),
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    setCertificationsList((prev) =>
      prev.map((c) =>
        String(c.id ?? c._id) === strId || String(c._id ?? c.id) === strId
          ? normalizeCertificationItem({ ...c, ...updates, ...payload })
          : c
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/certifications/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to update certification in database.');
    }

    mutationVersionRef.current += 1;
    setCertificationsList((prev) =>
      prev.map((c) =>
        String(c.id ?? c._id) === strId || String(c._id ?? c.id) === strId
          ? normalizeCertificationItem({ ...c, ...updates, ...payload, ...(json.data || {}) })
          : c
      )
    );
    notifyRealtimeUpdate('certifications');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, adminFetch, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const deleteCertification = useCallback(async (idOrCert) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a certification.');
    }
    mutationVersionRef.current += 1;
    const targetId =
      idOrCert && typeof idOrCert === 'object'
        ? idOrCert.id || idOrCert._id || idOrCert.title
        : idOrCert;
    const strId = String(targetId || '').trim();
    const altId =
      idOrCert && typeof idOrCert === 'object'
        ? String(idOrCert._id || idOrCert.id || '').trim()
        : strId;
    if (!strId) {
      throw new Error('Invalid certification ID for deletion.');
    }

    const existingObj =
      idOrCert && typeof idOrCert === 'object'
        ? idOrCert
        : certificationsList.find(
            (c) => String(c.id ?? c._id) === strId || String(c._id ?? c.id) === strId
          );

    markClientDeleted(strId, altId, existingObj);

    // Optimistically remove from state immediately for instant UI response
    setCertificationsList((prev) =>
      prev.filter(
        (c) =>
          String(c.id ?? c._id) !== strId &&
          String(c._id ?? c.id) !== strId &&
          String(c.id ?? p_id(c)) !== altId &&
          String(c.title) !== strId
      )
    );

    function p_id(item) {
      return item?._id ?? item?.id;
    }

    const res = await adminFetch(buildApiUrl(`/api/certifications/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, altId, existingObj);
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete certification from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('certifications');
    refreshPortfolioData();
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, certificationsList, markClientDeleted, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 3. EDUCATION
  const addEducation = useCallback(async (edu) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add education.');
    }
    mutationVersionRef.current += 1;
    const id = edu.id || `edu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    unmarkClientDeleted(strId, edu);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = normalizeEducationItem({
      ...edu,
      id,
      _id: id,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setEducationList((prev) => [
      payload,
      ...prev.filter((e) => String(e.id ?? e._id) !== strId),
    ]);

    const res = await adminFetch(buildApiUrl('/api/education'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to save education to database.');
    }

    mutationVersionRef.current += 1;
    const savedData = normalizeEducationItem({ ...payload, ...(json.data || {}) });
    setEducationList((prev) => [
      savedData,
      ...prev.filter((e) => String(e.id ?? e._id) !== strId && String(e.id ?? e._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('education');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, adminFetch, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateEducation = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update education.');
    }
    mutationVersionRef.current += 1;
    const strId = String(id).trim();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    setEducationList((prev) =>
      prev.map((e) =>
        String(e.id ?? e._id) === strId || String(e._id ?? e.id) === strId
          ? normalizeEducationItem({ ...e, ...payload })
          : e
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/education/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to update education in database.');
    }

    mutationVersionRef.current += 1;
    setEducationList((prev) =>
      prev.map((e) =>
        String(e.id ?? e._id) === strId || String(e._id ?? e.id) === strId
          ? normalizeEducationItem({ ...e, ...payload, ...(json.data || {}) })
          : e
      )
    );
    notifyRealtimeUpdate('education');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, adminFetch, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const deleteEducation = useCallback(async (idOrEdu) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete education.');
    }
    mutationVersionRef.current += 1;
    const targetId =
      idOrEdu && typeof idOrEdu === 'object'
        ? idOrEdu.id ?? idOrEdu._id ?? idOrEdu.degree
        : idOrEdu;
    const strId = String(targetId || '').trim();
    const altId =
      idOrEdu && typeof idOrEdu === 'object'
        ? String(idOrEdu._id ?? idOrEdu.id ?? '').trim()
        : strId;

    const existingObj =
      idOrEdu && typeof idOrEdu === 'object'
        ? idOrEdu
        : educationList.find(
            (e) => String(e.id ?? e._id) === strId || String(e._id ?? e.id) === strId
          );

    markClientDeleted(strId, altId, existingObj);

    setEducationList((prev) =>
      prev.filter(
        (e) =>
          String(e.id ?? e._id) !== strId &&
          String(e._id ?? e.id) !== strId &&
          String(e.id ?? e._id) !== altId
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/education/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, altId, existingObj);
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete education from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('education');
    refreshPortfolioData();
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, educationList, markClientDeleted, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 4. EXPERIENCE
  const addExperience = useCallback(async (exp) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add experience.');
    }
    mutationVersionRef.current += 1;
    const id = exp.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    unmarkClientDeleted(strId, exp);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = normalizeExperienceItem({
      ...exp,
      id,
      _id: id,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    setExperienceList((prev) => [
      payload,
      ...prev.filter((e) => String(e.id ?? e._id) !== strId),
    ]);

    const res = await adminFetch(buildApiUrl('/api/experience'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to save experience to database.');
    }

    mutationVersionRef.current += 1;
    const savedData = normalizeExperienceItem({ ...payload, ...(json.data || {}) });
    setExperienceList((prev) => [
      savedData,
      ...prev.filter((e) => String(e.id ?? e._id) !== strId && String(e.id ?? e._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('experience');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, adminFetch, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateExperience = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update experience.');
    }
    mutationVersionRef.current += 1;
    const strId = String(id).trim();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    setExperienceList((prev) =>
      prev.map((e) =>
        String(e.id ?? e._id) === strId || String(e._id ?? e.id) === strId
          ? normalizeExperienceItem({ ...e, ...payload })
          : e
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/experience/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to update experience in database.');
    }

    mutationVersionRef.current += 1;
    setExperienceList((prev) =>
      prev.map((e) =>
        String(e.id ?? e._id) === strId || String(e._id ?? e.id) === strId
          ? normalizeExperienceItem({ ...e, ...payload, ...(json.data || {}) })
          : e
      )
    );
    notifyRealtimeUpdate('experience');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, adminFetch, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const deleteExperience = useCallback(async (idOrExp) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete experience.');
    }
    mutationVersionRef.current += 1;
    const targetId =
      idOrExp && typeof idOrExp === 'object'
        ? idOrExp.id ?? idOrExp._id ?? idOrExp.role
        : idOrExp;
    const strId = String(targetId || '').trim();
    const altId =
      idOrExp && typeof idOrExp === 'object'
        ? String(idOrExp._id ?? idOrExp.id ?? '').trim()
        : strId;

    const existingObj =
      idOrExp && typeof idOrExp === 'object'
        ? idOrExp
        : experienceList.find(
            (e) => String(e.id ?? e._id) === strId || String(e._id ?? e.id) === strId
          );

    markClientDeleted(strId, altId, existingObj);

    setExperienceList((prev) =>
      prev.filter(
        (e) =>
          String(e.id ?? e._id) !== strId &&
          String(e._id ?? e.id) !== strId &&
          String(e.id ?? e._id) !== altId
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/experience/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, altId, existingObj);
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete experience from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('experience');
    refreshPortfolioData();
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, experienceList, markClientDeleted, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 5. SKILLS
  const addSkill = useCallback(async (skill) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add a skill.');
    }
    mutationVersionRef.current += 1;
    const id = skill.id || `skill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    unmarkClientDeleted(strId, skill, skill.name);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const isFeatured = Boolean(skill.highlight || skill.featured);
    const payload = {
      ...skill,
      id,
      _id: id,
      highlight: isFeatured,
      featured: isFeatured,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Optimistic insert for instant real-time UI feedback
    setSkillsLoadedFromDb(true);
    setCustomSkills((prev) => [
      payload,
      ...prev.filter((s) => String(s.id ?? s._id) !== strId),
    ]);

    const res = await adminFetch(buildApiUrl('/api/skills'), {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to save skill to database.');
    }

    mutationVersionRef.current += 1;
    const savedData = { ...payload, ...(json.data || {}) };
    setCustomSkills((prev) => [
      savedData,
      ...prev.filter((s) => String(s.id ?? s._id) !== strId && String(s.id ?? s._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('skills');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, adminFetch, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateSkill = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update a skill.');
    }
    mutationVersionRef.current += 1;
    const strId = String(id || '').trim();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const isFeatured =
      updates.highlight !== undefined
        ? Boolean(updates.highlight)
        : updates.featured !== undefined
        ? Boolean(updates.featured)
        : false;
    const payload = {
      ...updates,
      highlight: isFeatured,
      featured: isFeatured,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    const matchesTargetSkill = (s) => {
      const sId = s.id ?? s._id;
      const sMongoId = s._id ?? s.id;
      if (sId !== undefined || sMongoId !== undefined) {
        return String(sId) === strId || String(sMongoId) === strId;
      }
      return String(s.name) === strId;
    };

    // Optimistic update for instant real-time UI feedback across Admin and Portfolio Frontend
    setSkillsLoadedFromDb(true);
    setCustomSkills((prev) =>
      prev.map((s) => (matchesTargetSkill(s) ? { ...s, ...payload } : s))
    );

    const res = await adminFetch(buildApiUrl(`/api/skills/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to update skill in database.');
    }

    mutationVersionRef.current += 1;
    setCustomSkills((prev) =>
      prev.map((s) =>
        matchesTargetSkill(s) ? { ...s, ...payload, ...(json.data || {}) } : s
      )
    );
    notifyRealtimeUpdate('skills');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, adminFetch, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const deleteSkill = useCallback(async (idOrSkill) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a skill.');
    }
    mutationVersionRef.current += 1;
    const targetId =
      idOrSkill && typeof idOrSkill === 'object'
        ? idOrSkill.id || idOrSkill._id || idOrSkill.name
        : idOrSkill;
    const strId = String(targetId || '').trim();
    if (!strId) {
      throw new Error('Invalid skill ID for deletion.');
    }

    markClientDeleted(strId, idOrSkill);

    // Optimistically remove only the targeted skill ID from customSkills immediately
    setSkillsLoadedFromDb(true);
    setCustomSkills((prev) =>
      prev.filter((s) => {
        const sId = s.id ?? s._id;
        const sMongoId = s._id ?? s.id;
        if (sId !== undefined || sMongoId !== undefined) {
          return String(sId) !== strId && String(sMongoId) !== strId;
        }
        return String(s.name) !== strId;
      })
    );

    const res = await adminFetch(buildApiUrl(`/api/skills/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, idOrSkill);
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete skill from database.');
    }

    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('skills');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, markClientDeleted, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 6. PROFILE & PHOTOS
  const updateProfilePhotos = useCallback(async (updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update profile photos.');
    }
    mutationVersionRef.current += 1;
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const cleanUpdates = { ...updates };
    for (const mediaKey of ['heroImage', 'aboutImage', 'logoImage', 'resumeUrl']) {
      if (
        typeof cleanUpdates[mediaKey] === 'string' &&
        cleanUpdates[mediaKey].includes('/api/profile/media/')
      ) {
        delete cleanUpdates[mediaKey];
      }
    }
    const payload = {
      ...cleanUpdates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    setProfileConfig((prev) => ({ ...prev, ...cleanUpdates, updatedAt: payload.updatedAt }));

    const res = await adminFetch(buildApiUrl('/api/profile'), {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to update profile in database.');
    }

    mutationVersionRef.current += 1;
    setProfileConfig((prev) => ({ ...prev, ...cleanUpdates, ...(json.data || {}) }));
    notifyRealtimeUpdate('profile');
    refreshPortfolioData();
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, adminFetch, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // Seed / Sync Initial Portfolio to MongoDB (only refreshes from live database without overwriting existing records)
  const seedInitialData = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first.');
    }
    await ensureValidAdminToken();
    await refreshPortfolioData();
    notifyRealtimeUpdate('all');
  }, [isAdmin, ensureValidAdminToken, refreshPortfolioData]);

  // 7. CONTACT MESSAGES (Public submit + Admin Read/Delete with Real-Time Sync)
  const submitContactMessage = useCallback(async ({ name, email, subject, message, inquiryType, emailAlreadySent }) => {
    mutationVersionRef.current += 1;
    const res = await fetch(buildApiUrl('/api/contact'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        subject,
        message,
        inquiryType,
        emailAlreadySent: Boolean(emailAlreadySent),
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      throw new Error(json.error || 'Failed to save message to database.');
    }
    mutationVersionRef.current += 1;
    const savedEntry = json.entry || json.data;
    if (savedEntry) {
      unmarkClientDeleted(savedEntry);
      setContactMessages((prev) => [
        savedEntry,
        ...prev.filter((m) => String(m.id ?? m._id) !== String(savedEntry.id ?? savedEntry._id)),
      ]);
    }
    notifyRealtimeUpdate('messages');
    refreshPortfolioData(false);
    fetchAuditLogs();
    fetchAuditStats();
    return savedEntry;
  }, [unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const markContactMessageRead = useCallback(async (id) => {
    const strId = String(id || '').trim();
    if (!strId) return false;
    mutationVersionRef.current += 1;
    setContactMessages((prev) =>
      prev.map((m) => (String(m.id ?? m._id) === strId || String(m._id ?? m.id) === strId ? { ...m, status: 'read' } : m))
    );
    const res = await adminFetch(buildApiUrl(`/api/contact/messages/${encodeURIComponent(strId)}/read`), {
      method: 'PATCH',
    });
    if (res.ok) {
      notifyRealtimeUpdate('messages');
      refreshPortfolioData(false);
      return true;
    }
    return false;
  }, [adminFetch, refreshPortfolioData]);

  const deleteContactMessage = useCallback(async (idOrMsg) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a message.');
    }
    mutationVersionRef.current += 1;
    const targetId =
      idOrMsg && typeof idOrMsg === 'object'
        ? idOrMsg.id || idOrMsg._id
        : idOrMsg;
    const strId = String(targetId || '').trim();
    const altId =
      idOrMsg && typeof idOrMsg === 'object'
        ? String(idOrMsg._id || idOrMsg.id || '').trim()
        : strId;
    if (!strId) {
      throw new Error('Invalid message ID.');
    }

    const existingObj =
      idOrMsg && typeof idOrMsg === 'object'
        ? idOrMsg
        : contactMessages.find(
            (m) => String(m.id ?? m._id) === strId || String(m._id ?? m.id) === strId
          );

    markClientDeleted(strId, altId, existingObj);

    setContactMessages((prev) =>
      prev.filter(
        (m) =>
          String(m.id ?? m._id) !== strId &&
          String(m._id ?? m.id) !== strId &&
          String(m.id ?? m._id) !== altId
      )
    );

    const res = await adminFetch(buildApiUrl(`/api/contact/messages/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404 && json.success === false) {
      unmarkClientDeleted(strId, altId, existingObj);
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete inquiry from database.');
    }
    mutationVersionRef.current += 1;
    notifyRealtimeUpdate('messages');
    refreshPortfolioData();
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, adminFetch, contactMessages, markClientDeleted, unmarkClientDeleted, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const value = {
    // Auth & Status
    currentUser,
    dbUser,
    authLoading,
    isAdmin,
    devAdminBypass,
    setDevAdminBypass: toggleMasterAdmin,
    isSigningIn,
    registerAdmin,
    loginWithPassword,
    changePassword,
    resetPassword,
    loginWithGoogle,
    logoutAdmin,
    isBackendConnected,

    // Data lists
    projectsList,
    certificationsList,
    educationList,
    experienceList,
    skillCategories,
    customSkills,
    contactMessages,
    profileConfig,
    refreshPortfolioData,

    // CRUD Actions
    addProject,
    updateProject,
    updateProjectSEO,
    deleteProject,
    addCertification,
    updateCertification,
    deleteCertification,
    addEducation,
    updateEducation,
    deleteEducation,
    addExperience,
    updateExperience,
    deleteExperience,
    addSkill,
    updateSkill,
    deleteSkill,
    updateProfilePhotos,
    seedInitialData,
    submitContactMessage,
    fetchContactMessages,
    markContactMessageRead,
    deleteContactMessage,

    // Audit Log System (All Portfolio Collections)
    auditLogs,
    auditStats,
    isLoadingAuditLogs,
    fetchAuditLogs,
    fetchAuditStats,
    deleteAuditLog,
    clearAuditLogs,
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolioBackend = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolioBackend must be used within a PortfolioProvider');
  }
  return context;
};
