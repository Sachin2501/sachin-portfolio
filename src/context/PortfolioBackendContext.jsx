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

const normalizeCertificationItem = (c) => {
  if (!c) return c;
  const pdfDoc = [c.image, c.file, c.preview, c.link].find((v) => isPdfUrl(v));
  const imgPreview = [c.preview, c.image, c.file].find((v) => v && !isPdfUrl(v));
  const primaryDoc =
    c.image ||
    c.preview ||
    c.file ||
    '/certificates/previews/ibm-web-dev.png';
  return {
    ...c,
    id: c.id ?? c._id,
    _id: c._id ?? c.id,
    category: c.category || 'web',
    categoryLabel: c.categoryLabel || 'Professional Certification',
    image: c.image || imgPreview || pdfDoc || primaryDoc,
    preview: imgPreview || c.preview || c.image || primaryDoc,
    file: pdfDoc || c.file || c.image || primaryDoc,
    link: c.link || c.verifyUrl || c.file || '#',
    verifyUrl: c.verifyUrl || c.link || c.file || '#',
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

  // Auth state — strictly requires real login (JWT session or Google Admin Auth)
  const [currentUser, setCurrentUser] = useState(null);
  const [dbUser, setDbUser] = useState(() => {
    try {
      const token = localStorage.getItem('portfolio_admin_token');
      const stored = localStorage.getItem('portfolio_admin_user');
      if (!token || token === 'master_bypass_session_active') return null;
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const isSigningInRef = useRef(false);
  const [devAdminBypass, setDevAdminBypassState] = useState(false);

  const toggleMasterAdmin = useCallback((enabled) => {
    setDevAdminBypassState(Boolean(enabled));
  }, []);

  // Ensure a valid backend JWT token is present whenever the admin is logged in
  const ensureValidAdminToken = useCallback(async () => {
    const existing = localStorage.getItem('portfolio_admin_token');
    if (existing && existing !== 'master_bypass_session_active') {
      return existing;
    }
    const emailToVerify =
      dbUser?.email ||
      currentUser?.email ||
      (devAdminBypass ? ADMIN_EMAIL : null);
    if (!emailToVerify) return '';
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
          if (data.user) {
            localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
            setDbUser(data.user);
          }
          return data.token;
        }
      }
    } catch {
      // ignore
    }
    return '';
  }, [dbUser, currentUser, devAdminBypass]);

  // Data states
  const [projectsList, setProjectsList] = useState(() => initialProjects.map(normalizeProjectItem));
  const [certificationsList, setCertificationsList] = useState(() => initialCertifications.map(normalizeCertificationItem));
  const [educationList, setEducationList] = useState(() => initialEducation.map(normalizeEducationItem));
  const [experienceList, setExperienceList] = useState(() => initialExperiences.map(normalizeExperienceItem));
  const [customSkills, setCustomSkills] = useState(() =>
    (initialSkillCategories || []).flatMap((cat) =>
      (cat.skills || []).map((s, idx) => ({
        id: `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        _id: `skill_${cat.id}_${idx}_${s.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        domainId: cat.id,
        domainTitle: cat.title,
        name: s.name,
        level: s.level || 'Advanced',
        icon: s.icon || 'fas fa-code',
        highlight: Boolean(s.highlight || s.featured),
        featured: Boolean(s.highlight || s.featured),
      }))
    )
  );
  const [skillsLoadedFromDb, setSkillsLoadedFromDb] = useState(true);
  const [contactMessages, setContactMessages] = useState([]);
  const [profileConfig, setProfileConfig] = useState({
    heroImage: initialPersonalInfo.heroImage,
    aboutImage: initialPersonalInfo.aboutImage,
    logoImage: initialPersonalInfo.logoImage,
    resumeUrl: initialPersonalInfo.resumeUrl,
    name: initialPersonalInfo.name,
    title: initialPersonalInfo.title,
    bioLead: initialPersonalInfo.bioLead,
  });

  const [isBackendConnected, setIsBackendConnected] = useState(true);

  // Audit Logs State & Stats
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState({
    total: 0,
    byCollection: { projects: 0, experience: 0, certifications: 0, education: 0, skills: 0, profile: 0 },
    byAction: { CREATE: 0, UPDATE: 0, DELETE: 0 },
    recent24h: 0,
    admins: {},
    lastActivity: null,
  });
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);

  const fetchAuditLogs = useCallback(async (filters = {}) => {
    setIsLoadingAuditLogs(true);
    try {
      const params = new URLSearchParams();
      if (filters.collection && filters.collection !== 'all') params.append('collection', filters.collection);
      if (filters.action && filters.action !== 'all') params.append('action', filters.action);
      if (filters.user && filters.user !== 'all') params.append('user', filters.user);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', String(filters.limit));

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(buildApiUrl(`/api/audit-logs${queryStr}`), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAuditLogs(json.data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch audit logs:', err.message);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  }, []);

  const fetchAuditStats = useCallback(async () => {
    try {
      const res = await fetch(buildApiUrl('/api/audit-logs/stats'), {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setAuditStats(json.data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch audit stats:', err.message);
    }
  }, []);

  // Verify saved JWT Session Token on mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const token = localStorage.getItem('portfolio_admin_token');
        if (token && token !== 'master_bypass_session_active') {
          const res = await fetch(buildApiUrl('/api/auth/me'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user) {
              setDbUser(data.user);
              localStorage.setItem('portfolio_admin_user', JSON.stringify(data.user));
            }
          } else if (res.status === 401) {
            localStorage.removeItem('portfolio_admin_token');
            localStorage.removeItem('portfolio_admin_user');
            setDbUser(null);
          }
        }
      } catch (err) {
        console.warn('Session verification note:', err.message);
      }
    };
    verifySession();
  }, []);

  // Real-time Data Fetch from MongoDB Express Backend (non-blocking per collection, cache-busted)
  const refreshPortfolioData = useCallback(async () => {
    const fetchOpts = { cache: 'no-store' };
    try {
      await Promise.all([
        fetch(buildApiUrl('/api/projects'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              if (Array.isArray(d.data)) {
                setProjectsList(d.data.map(normalizeProjectItem));
                setIsBackendConnected(true);
              }
            }
          })
          .catch(() => null),
        fetch(buildApiUrl('/api/certifications'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              if (Array.isArray(d.data)) {
                setCertificationsList(d.data.map(normalizeCertificationItem));
              }
            }
          })
          .catch(() => null),
        fetch(buildApiUrl('/api/education'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              if (Array.isArray(d.data)) {
                setEducationList(d.data.map(normalizeEducationItem));
              }
            }
          })
          .catch(() => null),
        fetch(buildApiUrl('/api/experience'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              if (Array.isArray(d.data)) {
                setExperienceList(d.data.map(normalizeExperienceItem));
              }
            }
          })
          .catch(() => null),
        fetch(buildApiUrl('/api/skills'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              if (Array.isArray(d.data)) {
                setCustomSkills(d.data);
                setSkillsLoadedFromDb(true);
              }
            }
          })
          .catch(() => null),
        fetch(buildApiUrl('/api/profile'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              if (d.data) {
                setProfileConfig((prev) => ({ ...prev, ...d.data }));
              }
            }
          })
          .catch(() => null),
        fetch(buildApiUrl('/api/contact/messages'), fetchOpts)
          .then(async (res) => {
            if (res && res.ok) {
              const d = await res.json();
              const list = Array.isArray(d.messages)
                ? d.messages
                : Array.isArray(d.data)
                ? d.data
                : null;
              if (list) {
                setContactMessages(list);
              }
            }
          })
          .catch(() => null),
      ]);

      fetchAuditLogs();
      fetchAuditStats();
    } catch (err) {
      console.warn('MongoDB data sync notice:', err.message);
    }
  }, [fetchAuditLogs, fetchAuditStats]);

  useEffect(() => {
    refreshPortfolioData();
  }, [refreshPortfolioData]);

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

  // Compute Admin Status — Strictly requires logged-in admin user
  const isAdmin = useMemo(() => {
    if (dbUser && dbUser.role === 'admin') return true;
    if (currentUser) {
      return (
        currentUser.email === ADMIN_EMAIL ||
        currentUser.email === 'sachinkumar.gheura@gmail.com'
      );
    }
    return false;
  }, [currentUser, dbUser]);

  // Build domain skill categories directly from database skills so Add, Edit, and Delete work 100% in real-time
  const skillCategories = useMemo(() => {
    if (!skillsLoadedFromDb && (!customSkills || customSkills.length === 0)) {
      return initialSkillCategories;
    }

    const normalizeDomain = (rawId) => {
      const id = String(rawId || 'frontend').toLowerCase().trim();
      if (id === 'full-stack' || id === 'frontend') return 'frontend';
      if (id === 'backend') return 'backend';
      if (id === 'ai-ml' || id === 'ai') return 'ai-ml';
      if (id === 'languages' || id === 'programming-languages') return 'programming-languages';
      if (id === 'tools' || id === 'cloud' || id === 'tools-devops') return 'tools-devops';
      return 'frontend';
    };

    return initialSkillCategories.map((category) => {
      const domainSkills = (customSkills || [])
        .filter((s) => normalizeDomain(s.domainId) === category.id)
        .map((s) => ({
          name: s.name,
          level: s.level || 'Advanced',
          icon: s.icon || 'fas fa-check-circle',
          highlight: !!(s.highlight || s.featured),
          featured: !!(s.highlight || s.featured),
          isCustom: true,
          id: s.id ?? s._id,
          _id: s._id ?? s.id,
          domainId: normalizeDomain(s.domainId),
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
    await ensureValidAdminToken();
    const strId = String(id || '').trim();
    if (!strId) {
      throw new Error('Invalid audit log ID.');
    }

    // Optimistic removal for instant UI update
    setAuditLogs((prev) => prev.filter((l) => String(l.id ?? l._id) !== strId && String(l._id ?? l.id) !== strId));
    setAuditStats((prev) => ({
      ...prev,
      total: Math.max(0, (prev?.total || 1) - 1),
    }));

    const res = await fetch(buildApiUrl(`/api/audit-logs/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await fetchAuditLogs();
      await fetchAuditStats();
      throw new Error(json.error || 'Failed to delete audit log from database.');
    }

    notifyRealtimeUpdate('audit_logs');
    await fetchAuditLogs();
    await fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const clearAuditLogs = useCallback(async (collection = null) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first.');
    }
    await ensureValidAdminToken();
    const targetCol = collection && collection !== 'all' ? String(collection).trim().toLowerCase() : null;

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

    const res = await fetch(buildApiUrl('/api/audit-logs/clear'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(targetCol ? { collection: targetCol } : {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await fetchAuditLogs();
      await fetchAuditStats();
      throw new Error(json.error || 'Failed to clear audit logs from database.');
    }

    notifyRealtimeUpdate('audit_logs');
    await fetchAuditLogs();
    await fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  // ==========================================
  // BACKEND CRUD OPERATIONS (STRICT LOGIN + REAL-TIME DATABASE & FRONTEND SYNC)
  // ==========================================

  // 1. PROJECTS
  const addProject = useCallback(async (project) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add a project.');
    }
    await ensureValidAdminToken();
    const id = project.id || `proj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = normalizeProjectItem({
      ...project,
      id,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await fetch(buildApiUrl('/api/projects'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to save project to database.');
    }

    const savedData = normalizeProjectItem({ ...payload, ...(json.data || {}) });
    setProjectsList((prev) => [
      savedData,
      ...prev.filter((p) => String(p.id ?? p._id) !== strId && String(p.id ?? p._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('projects');
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const updateProject = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update a project.');
    }
    await ensureValidAdminToken();
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(buildApiUrl(`/api/projects/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to update project in database.');
    }

    setProjectsList((prev) =>
      prev.map((p) =>
        String(p.id ?? p._id) === strId
          ? normalizeProjectItem({ ...p, ...payload, ...(json.data || {}) })
          : p
      )
    );
    notifyRealtimeUpdate('projects');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const updateProjectSEO = useCallback(async (id, seoData) => {
    return updateProject(id, { seo: seoData });
  }, [updateProject]);

  const deleteProject = useCallback(async (id) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a project.');
    }
    await ensureValidAdminToken();
    const strId = String(id);

    const res = await fetch(buildApiUrl(`/api/projects/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to delete project from database.');
    }

    setProjectsList((prev) => prev.filter((p) => String(p.id ?? p._id) !== strId));
    notifyRealtimeUpdate('projects');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  // 2. CERTIFICATIONS
  const addCertification = useCallback(async (cert) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add a certification.');
    }
    await ensureValidAdminToken();
    const id = cert.id || `cert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const rawDoc = cert.file || cert.image || cert.preview || '';
    const isPdf = typeof rawDoc === 'string' && rawDoc.startsWith('data:application/pdf');
    const isDataImg = typeof rawDoc === 'string' && rawDoc.startsWith('data:image/');

    // Avoid sending 3 duplicate copies of a large base64 data URI over the network
    const wirePayload = {
      ...cert,
      id,
      _id: id,
      file: isPdf ? rawDoc : cert.file || '',
      image: isPdf ? '' : isDataImg ? rawDoc : cert.image || '',
      preview: isPdf || isDataImg ? '' : cert.preview || '',
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(buildApiUrl('/api/certifications'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(wirePayload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to save certification to database.');
    }

    const savedData = normalizeCertificationItem({ ...cert, ...wirePayload, ...(json.data || {}) });
    setCertificationsList((prev) => [
      savedData,
      ...prev.filter((c) => String(c.id ?? c._id) !== strId && String(c.id ?? c._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('certifications');
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const updateCertification = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update a certification.');
    }
    await ensureValidAdminToken();
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const rawDoc = updates.file || updates.image || updates.preview || '';
    const isPdf = typeof rawDoc === 'string' && rawDoc.startsWith('data:application/pdf');
    const isDataImg = typeof rawDoc === 'string' && rawDoc.startsWith('data:image/');

    const payload = {
      ...updates,
      ...(rawDoc
        ? {
            file: isPdf ? rawDoc : updates.file || '',
            image: isPdf ? '' : isDataImg ? rawDoc : updates.image || '',
            preview: isPdf || isDataImg ? '' : updates.preview || '',
          }
        : {}),
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(buildApiUrl(`/api/certifications/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to update certification in database.');
    }

    setCertificationsList((prev) =>
      prev.map((c) =>
        String(c.id ?? c._id) === strId
          ? normalizeCertificationItem({ ...c, ...updates, ...(json.data || {}) })
          : c
      )
    );
    notifyRealtimeUpdate('certifications');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const deleteCertification = useCallback(async (idOrCert) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a certification.');
    }
    await ensureValidAdminToken();
    const targetId =
      idOrCert && typeof idOrCert === 'object'
        ? idOrCert.id || idOrCert._id || idOrCert.title
        : idOrCert;
    const strId = String(targetId || '').trim();
    if (!strId) {
      throw new Error('Invalid certification ID for deletion.');
    }

    // Optimistically remove from state immediately for instant UI response
    setCertificationsList((prev) =>
      prev.filter(
        (c) =>
          String(c.id ?? c._id) !== strId &&
          String(c._id ?? c.id) !== strId &&
          String(c.title) !== strId
      )
    );

    const res = await fetch(buildApiUrl(`/api/certifications/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to delete certification from database.');
    }

    notifyRealtimeUpdate('certifications');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 3. EDUCATION
  const addEducation = useCallback(async (edu) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add education.');
    }
    await ensureValidAdminToken();
    const id = edu.id || `edu_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = normalizeEducationItem({
      ...edu,
      id,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await fetch(buildApiUrl('/api/education'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to save education to database.');
    }

    const savedData = normalizeEducationItem({ ...payload, ...(json.data || {}) });
    setEducationList((prev) => [
      savedData,
      ...prev.filter((e) => String(e.id ?? e._id) !== strId && String(e.id ?? e._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('education');
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const updateEducation = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update education.');
    }
    await ensureValidAdminToken();
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(buildApiUrl(`/api/education/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to update education in database.');
    }

    setEducationList((prev) =>
      prev.map((e) =>
        String(e.id ?? e._id) === strId
          ? normalizeEducationItem({ ...e, ...payload, ...(json.data || {}) })
          : e
      )
    );
    notifyRealtimeUpdate('education');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const deleteEducation = useCallback(async (id) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete education.');
    }
    await ensureValidAdminToken();
    const strId = String(id);

    const res = await fetch(buildApiUrl(`/api/education/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to delete education from database.');
    }

    setEducationList((prev) => prev.filter((e) => String(e.id ?? e._id) !== strId));
    notifyRealtimeUpdate('education');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  // 4. EXPERIENCE
  const addExperience = useCallback(async (exp) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add experience.');
    }
    await ensureValidAdminToken();
    const id = exp.id || `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = normalizeExperienceItem({
      ...exp,
      id,
      authorUid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await fetch(buildApiUrl('/api/experience'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to save experience to database.');
    }

    const savedData = normalizeExperienceItem({ ...payload, ...(json.data || {}) });
    setExperienceList((prev) => [
      savedData,
      ...prev.filter((e) => String(e.id ?? e._id) !== strId && String(e.id ?? e._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('experience');
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const updateExperience = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update experience.');
    }
    await ensureValidAdminToken();
    const strId = String(id);
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(buildApiUrl(`/api/experience/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to update experience in database.');
    }

    setExperienceList((prev) =>
      prev.map((e) =>
        String(e.id ?? e._id) === strId
          ? normalizeExperienceItem({ ...e, ...payload, ...(json.data || {}) })
          : e
      )
    );
    notifyRealtimeUpdate('experience');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  const deleteExperience = useCallback(async (id) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete experience.');
    }
    await ensureValidAdminToken();
    const strId = String(id);

    const res = await fetch(buildApiUrl(`/api/experience/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to delete experience from database.');
    }

    setExperienceList((prev) => prev.filter((e) => String(e.id ?? e._id) !== strId));
    notifyRealtimeUpdate('experience');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  // 5. SKILLS
  const addSkill = useCallback(async (skill) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to add a skill.');
    }
    await ensureValidAdminToken();
    const id = skill.id || `skill_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const strId = String(id);
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

    const res = await fetch(buildApiUrl('/api/skills'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to save skill to database.');
    }

    const savedData = { ...payload, ...(json.data || {}) };
    setCustomSkills((prev) => [
      savedData,
      ...prev.filter((s) => String(s.id ?? s._id) !== strId && String(s.id ?? s._id) !== String(savedData.id)),
    ]);
    notifyRealtimeUpdate('skills');
    fetchAuditLogs();
    fetchAuditStats();
    return savedData.id || id;
  }, [isAdmin, dbUser, ensureValidAdminToken, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const updateSkill = useCallback(async (id, updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update a skill.');
    }
    await ensureValidAdminToken();
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

    // Optimistic update for instant real-time UI feedback across Admin and Portfolio Frontend
    setSkillsLoadedFromDb(true);
    setCustomSkills((prev) =>
      prev.map((s) =>
        String(s.id ?? s._id) === strId ||
        String(s._id ?? s.id) === strId ||
        String(s.name) === strId
          ? { ...s, ...payload }
          : s
      )
    );

    const res = await fetch(buildApiUrl(`/api/skills/${encodeURIComponent(strId)}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to update skill in database.');
    }

    setCustomSkills((prev) =>
      prev.map((s) =>
        String(s.id ?? s._id) === strId ||
        String(s._id ?? s.id) === strId ||
        String(s.name) === strId
          ? { ...s, ...payload, ...(json.data || {}) }
          : s
      )
    );
    notifyRealtimeUpdate('skills');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, ensureValidAdminToken, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  const deleteSkill = useCallback(async (idOrSkill) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a skill.');
    }
    await ensureValidAdminToken();
    const targetId =
      idOrSkill && typeof idOrSkill === 'object'
        ? idOrSkill.id || idOrSkill._id || idOrSkill.name
        : idOrSkill;
    const strId = String(targetId || '').trim();
    const targetName =
      idOrSkill && typeof idOrSkill === 'object' && idOrSkill.name
        ? String(idOrSkill.name).trim()
        : strId;
    if (!strId) {
      throw new Error('Invalid skill ID for deletion.');
    }

    // Optimistically remove from customSkills immediately
    setSkillsLoadedFromDb(true);
    setCustomSkills((prev) =>
      prev.filter(
        (s) =>
          String(s.id ?? s._id) !== strId &&
          String(s._id ?? s.id) !== strId &&
          String(s.name) !== strId &&
          String(s.name) !== targetName
      )
    );

    const res = await fetch(buildApiUrl(`/api/skills/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to delete skill from database.');
    }

    notifyRealtimeUpdate('skills');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

  // 6. PROFILE & PHOTOS
  const updateProfilePhotos = useCallback(async (updates) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to update profile photos.');
    }
    await ensureValidAdminToken();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';
    const payload = {
      ...updates,
      authorUid,
      updatedAt: new Date().toISOString(),
    };

    const res = await fetch(buildApiUrl('/api/profile'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      if (res.status === 401) {
        throw new Error(json.error || 'Admin session expired. Please Sign In again.');
      }
      throw new Error(json.error || 'Failed to update profile in database.');
    }

    setProfileConfig((prev) => ({ ...prev, ...updates, ...(json.data || {}) }));
    notifyRealtimeUpdate('profile');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, dbUser, ensureValidAdminToken, fetchAuditLogs, fetchAuditStats]);

  // Seed / Sync Initial Portfolio to MongoDB
  const seedInitialData = useCallback(async () => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first.');
    }
    await ensureValidAdminToken();
    const authorUid = dbUser?.username || auth.currentUser?.uid || 'admin_sachin';

    for (const proj of initialProjects) {
      try {
        await fetch(buildApiUrl('/api/projects'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ ...proj, authorUid }),
        });
      } catch {}
    }

    try {
      await fetch(buildApiUrl('/api/profile'), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          heroImage: initialPersonalInfo.heroImage,
          aboutImage: initialPersonalInfo.aboutImage,
          logoImage: initialPersonalInfo.logoImage,
          resumeUrl: initialPersonalInfo.resumeUrl,
          name: initialPersonalInfo.name,
          title: initialPersonalInfo.title,
          bioLead: initialPersonalInfo.bioLead,
          authorUid,
        }),
      });
    } catch {}

    await refreshPortfolioData();
    notifyRealtimeUpdate('all');
  }, [isAdmin, dbUser, ensureValidAdminToken, refreshPortfolioData]);

  // 7. CONTACT MESSAGES (Public submit + Admin Read/Delete with Real-Time Sync)
  const submitContactMessage = useCallback(async ({ name, email, subject, message, inquiryType, emailAlreadySent }) => {
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
    const savedEntry = json.entry || json.data;
    if (savedEntry) {
      setContactMessages((prev) => [
        savedEntry,
        ...prev.filter((m) => String(m.id ?? m._id) !== String(savedEntry.id ?? savedEntry._id)),
      ]);
    }
    notifyRealtimeUpdate('messages');
    fetchAuditLogs();
    fetchAuditStats();
    return savedEntry;
  }, [fetchAuditLogs, fetchAuditStats]);

  const markContactMessageRead = useCallback(async (id) => {
    const strId = String(id || '').trim();
    if (!strId) return false;
    setContactMessages((prev) =>
      prev.map((m) => (String(m.id ?? m._id) === strId ? { ...m, status: 'read' } : m))
    );
    const res = await fetch(buildApiUrl(`/api/contact/messages/${encodeURIComponent(strId)}/read`), {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      notifyRealtimeUpdate('messages');
      return true;
    }
    return false;
  }, []);

  const deleteContactMessage = useCallback(async (id) => {
    if (!isAdmin) {
      throw new Error('Admin Login required! Please Sign In first to delete a message.');
    }
    await ensureValidAdminToken();
    const strId = String(id || '').trim();
    if (!strId) {
      throw new Error('Invalid message ID.');
    }
    setContactMessages((prev) => prev.filter((m) => String(m.id ?? m._id) !== strId));
    const res = await fetch(buildApiUrl(`/api/contact/messages/${encodeURIComponent(strId)}`), {
      method: 'DELETE',
      headers: getDeleteHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) {
      await refreshPortfolioData();
      throw new Error(json.error || 'Failed to delete inquiry from database.');
    }
    notifyRealtimeUpdate('messages');
    fetchAuditLogs();
    fetchAuditStats();
    return true;
  }, [isAdmin, ensureValidAdminToken, refreshPortfolioData, fetchAuditLogs, fetchAuditStats]);

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
