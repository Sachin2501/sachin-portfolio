import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  Image,
  RefreshCw,
  Search,
  Mail,
  Activity,
  FolderGit2,
  Award,
  Inbox,
  Check,
  Reply,
  Globe,
  Sparkles,
  Pencil,
  Edit3,
  FileText,
  History,
  Lock,
  LogIn,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { usePortfolioBackend, getDeleteHeaders } from '../context/PortfolioBackendContext.jsx';
import { personalInfo } from '../data/portfolioData.js';
import { AdminTopBar } from './components/AdminTopBar.jsx';
import { AdminSidebar } from './components/AdminSidebar.jsx';
import { AdminMobileNav } from './components/AdminMobileNav.jsx';
import { MongoInspectorTab } from './components/MongoInspectorTab.jsx';
import { ProjectSeoGeneratorTab } from './components/ProjectSeoGeneratorTab.jsx';
import { AdminAuditLogs } from './components/AdminAuditLogs.jsx';
import { FileUploadZone } from './components/FileUploadZone.jsx';
import { AdminAuthModal } from './components/AdminAuthModal.jsx';
import { CertificateModal } from '../portfolio-frontend/components/CertificateModal.jsx';
import { buildApiUrl } from '../config/api.js';
import './admin.css';

export const AdminControlPanel = ({ onNavigateToFrontend }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [previewCertificate, setPreviewCertificate] = useState(null);

  const {
    currentUser,
    dbUser,
    isAdmin,
    setDevAdminBypass,
    isSigningIn,
    loginWithGoogle,
    logoutAdmin,
    isBackendConnected,
    projectsList,
    certificationsList,
    educationList,
    experienceList,
    skillCategories,
    customSkills,
    profileConfig,
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
    contactMessages: ctxContactMessages,
    markContactMessageRead,
    deleteContactMessage,
    refreshPortfolioData,
    auditLogs,
    auditStats,
    isLoadingAuditLogs,
    fetchAuditLogs,
    fetchAuditStats,
    deleteAuditLog,
    clearAuditLogs,
  } = usePortfolioBackend();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [statusMessage, setStatusMessage] = useState(null);

  // Active editing IDs for in-place edit & MongoDB updates
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editingCertId, setEditingCertId] = useState(null);
  const [editingEduId, setEditingEduId] = useState(null);
  const [editingExpId, setEditingExpId] = useState(null);
  const [editingSkillId, setEditingSkillId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Backend API metrics state
  const [apiStats, setApiStats] = useState({
    pageViews: 1540,
    inquiriesCount: 2,
    unreadInquiries: 1,
    serverUptimeSeconds: 0,
    counts: {
      projects: projectsList.length,
      certifications: certificationsList.length,
      education: educationList.length,
      experience: experienceList.length,
      skills: customSkills.length,
      messages: 2,
    },
  });
  const [contactMessages, setContactMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [backendHealth, setBackendHealth] = useState({ status: 'checking', runtime: 'Node.js' });

  // Category Filter & Search states in Admin (matching Frontend categories)
  const [projectSearch, setProjectSearch] = useState('');
  const [projectCategoryFilter, setProjectCategoryFilter] = useState('All');
  const [certCategoryFilter, setCertCategoryFilter] = useState('all');
  const [eduCategoryFilter, setEduCategoryFilter] = useState('all');
  const [skillCategoryFilter, setSkillCategoryFilter] = useState('all');
  const [expCategoryFilter, setExpCategoryFilter] = useState('all');

  // Form states
  const [projectForm, setProjectForm] = useState({
    title: '',
    category: 'Full Stack & MERN Architecture',
    description: '',
    technologies: '',
    github: '',
    live: '',
    image: '/images/My_portfolio.png',
    featured: true,
  });

  const [certForm, setCertForm] = useState({
    title: '',
    issuer: 'IBM SkillsBuild / Coursera',
    date: '2025',
    category: 'web',
    credentialId: '',
    skills: '',
    image: '',
    link: '',
  });

  const [eduForm, setEduForm] = useState({
    degree: 'Bachelor of Technology in Computer Science & Engineering',
    institution: '',
    location: 'India',
    period: '2023 - 2027',
    grade: 'Current CGPA: 7.49',
    status: 'Pursuing (Undergraduate)',
    category: 'engineering',
    skills: 'C++, Python, Data Structures, Database Systems, AI/ML',
    description: '',
  });

  const [expForm, setExpForm] = useState({
    role: 'AI & Machine Learning Intern',
    company: '',
    location: 'Remote',
    period: '2025 - 2026',
    category: 'ai',
    skills: 'Python, Machine Learning, Deep Learning',
    description: '',
    certificateId: '',
    certificateTitle: '',
    certificateIssuer: '',
    certificateDate: '',
    certificateFile: '',
    certificatePreview: '',
  });

  const [skillForm, setSkillForm] = useState({
    name: '',
    domainId: 'frontend',
    level: 'Advanced',
    icon: 'fab fa-react',
    highlight: false,
    featured: false,
  });

  const [photoForm, setPhotoForm] = useState({
    heroImage: profileConfig.heroImage || personalInfo.heroImage,
    aboutImage: profileConfig.aboutImage || personalInfo.aboutImage,
    logoImage: profileConfig.logoImage || personalInfo.logoImage,
    resumeUrl: profileConfig.resumeUrl || personalInfo.resumeUrl,
    name: profileConfig.name || personalInfo.name,
    title: profileConfig.title || personalInfo.title,
    bioLead: profileConfig.bioLead || personalInfo.bioLead,
  });

  const showToast = (text, isError = false) => {
    setStatusMessage({ text, isError });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  // Enforce Admin login before any Add / Edit / Delete operation
  const requireAdminAuth = (actionLabel = 'make changes') => {
    if (!isAdmin) {
      showToast(`Admin Login Required to ${actionLabel}! Please Sign In first.`, true);
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  // Fetch Node.js backend and MongoDB data (cache-busted for real-time accuracy)
  const fetchBackendData = useCallback(async () => {
    const fetchOpts = { cache: 'no-store' };
    try {
      const [statsRes, healthRes] = await Promise.all([
        fetch(buildApiUrl('/api/stats'), fetchOpts).catch(() => null),
        fetch(buildApiUrl('/api/health'), fetchOpts).catch(() => null),
      ]);
      if (statsRes?.ok) {
        const statsData = await statsRes.json();
        setApiStats((prev) => ({ ...prev, ...statsData }));
      }
      if (healthRes?.ok) {
        const healthData = await healthRes.json();
        setBackendHealth(healthData);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchContactMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(buildApiUrl('/api/contact/messages'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const list = data.messages || data.data || [];
        setContactMessages(list);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Keep local contactMessages synchronized in real-time with PortfolioBackendContext
  useEffect(() => {
    if (Array.isArray(ctxContactMessages)) {
      setContactMessages(ctxContactMessages);
    }
  }, [ctxContactMessages]);

  useEffect(() => {
    fetchBackendData();
    fetchContactMessages();
    const interval = setInterval(() => {
      fetchBackendData();
      fetchContactMessages();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchBackendData, fetchContactMessages]);

  // Refresh contact messages and audit logs immediately when switching tabs
  useEffect(() => {
    if (activeTab === 'messages' || activeTab === 'dashboard' || activeTab === 'mongodb') {
      fetchContactMessages();
      fetchBackendData();
    }
    if (activeTab === 'audit-logs' || activeTab === 'dashboard') {
      fetchAuditLogs();
      fetchAuditStats();
    }
  }, [activeTab, fetchContactMessages, fetchBackendData, fetchAuditLogs, fetchAuditStats]);

  useEffect(() => {
    setPhotoForm((prev) => ({
      ...prev,
      heroImage: profileConfig.heroImage || prev.heroImage,
      aboutImage: profileConfig.aboutImage || prev.aboutImage,
      logoImage: profileConfig.logoImage || prev.logoImage,
      resumeUrl: profileConfig.resumeUrl || prev.resumeUrl,
      name: profileConfig.name || prev.name,
      title: profileConfig.title || prev.title,
      bioLead: profileConfig.bioLead || prev.bioLead,
    }));
  }, [profileConfig]);

  // Handlers for Projects (Add, Edit & Delete with Auth Check + MongoDB persistence)
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!requireAdminAuth(editingProjectId ? 'update project' : 'add project')) return;

    if (!projectForm.title.trim() || !projectForm.description.trim()) {
      showToast('Project title and description are required.', true);
      return;
    }
    setIsSubmitting(true);
    try {
      const techs = projectForm.technologies
        ? Array.isArray(projectForm.technologies)
          ? projectForm.technologies
          : projectForm.technologies
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
        : ['React', 'JavaScript', 'Node.js'];

      const payload = {
        title: projectForm.title.trim(),
        category: projectForm.category,
        description: projectForm.description.trim(),
        technologies: techs,
        tech: techs,
        github: projectForm.github.trim() || '#',
        githubUrl: projectForm.github.trim() || '#',
        live: projectForm.live.trim() || '#',
        liveUrl: projectForm.live.trim() || '#',
        image: projectForm.image.trim() || '/images/My_portfolio.png',
        featured: projectForm.featured,
      };

      if (editingProjectId) {
        await updateProject(editingProjectId, payload);
        showToast(`Project "${projectForm.title}" updated in MongoDB!`);
        setEditingProjectId(null);
      } else {
        await addProject(payload);
        showToast(`Project "${projectForm.title}" saved to MongoDB & Live Frontend!`);
      }

      setProjectForm({
        title: '',
        category: 'Full Stack & MERN Architecture',
        description: '',
        technologies: '',
        github: '',
        live: '',
        image: '/images/My_portfolio.png',
        featured: true,
      });
      fetchBackendData();
    } catch (err) {
      showToast('Error saving project: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditProject = (proj) => {
    if (!requireAdminAuth('edit project')) return;
    const pId = proj.id || proj._id;
    setEditingProjectId(pId);
    setProjectForm({
      title: proj.title || '',
      category: proj.category || 'Full Stack & MERN Architecture',
      description: proj.description || '',
      technologies:
        Array.isArray(proj.technologies) && proj.technologies.length > 0
          ? proj.technologies.join(', ')
          : Array.isArray(proj.tech)
          ? proj.tech.join(', ')
          : proj.technologies || '',
      github: proj.github || proj.githubUrl || '',
      live: proj.live || proj.liveUrl || '',
      image: proj.image || '/images/My_portfolio.png',
      featured: proj.featured !== undefined ? !!proj.featured : true,
    });
    const formEl = document.getElementById('project-admin-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEditProject = () => {
    setEditingProjectId(null);
    setProjectForm({
      title: '',
      category: 'Full Stack & MERN Architecture',
      description: '',
      technologies: '',
      github: '',
      live: '',
      image: '/images/My_portfolio.png',
      featured: true,
    });
  };

  const handleDeleteProject = async (proj) => {
    if (!requireAdminAuth('delete project')) return;
    try {
      await deleteProject(proj.id || proj._id);
      if (editingProjectId === (proj.id || proj._id)) {
        handleCancelEditProject();
      }
      showToast(`Project "${proj.title}" deleted permanently from MongoDB & Frontend!`);
      fetchBackendData();
    } catch (err) {
      showToast('Failed to delete project: ' + err.message, true);
    }
  };

  // Handlers for Certifications (Category-wise Add, Edit & Delete with Auth Check + PDF support)
  const certCategoryLabels = {
    web: 'Web Development',
    ai: 'Artificial Intelligence',
    isro: 'ISRO',
    internship: 'Internships',
    other: 'Other Courses',
  };

  const handleAddCert = async (e) => {
    e.preventDefault();
    if (!requireAdminAuth(editingCertId ? 'update certification' : 'add certification')) return;

    if (!certForm.title.trim() || !certForm.issuer.trim()) {
      showToast('Title and Issuer are required.', true);
      return;
    }
    setIsSubmitting(true);
    try {
      const skillsArray = certForm.skills
        ? Array.isArray(certForm.skills)
          ? certForm.skills
          : certForm.skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : [];

      const catKey = certForm.category || 'web';
      const uploadedDoc = certForm.image ? certForm.image.trim() : '';
      const externalLink = certForm.link ? certForm.link.trim() : '';
      const isUploadedPdf =
        uploadedDoc.startsWith('data:application/pdf') ||
        uploadedDoc.toLowerCase().endsWith('.pdf') ||
        uploadedDoc.toLowerCase().includes('.pdf?');
      const isExternalPdf =
        externalLink.startsWith('data:application/pdf') ||
        externalLink.toLowerCase().endsWith('.pdf') ||
        externalLink.toLowerCase().includes('.pdf?');

      const primaryDoc = uploadedDoc || externalLink || '/certificates/previews/ibm-web-dev.png';
      const pdfOrDocFile = isUploadedPdf
        ? uploadedDoc
        : isExternalPdf
        ? externalLink
        : '';

      // Avoid duplicating multi-MB base64 strings across 4 separate fields
      const payload = {
        title: certForm.title.trim(),
        issuer: certForm.issuer.trim(),
        date: certForm.date.trim() || '2025',
        category: catKey,
        categoryLabel: certCategoryLabels[catKey] || 'Web Development',
        credentialId: certForm.credentialId.trim() || `SK-${Date.now().toString().slice(-6)}`,
        skills: skillsArray,
        image: isUploadedPdf ? '' : primaryDoc,
        file: pdfOrDocFile,
        preview: '',
        link: externalLink || (! uploadedDoc.startsWith('data:') ? pdfOrDocFile : ''),
      };

      if (editingCertId) {
        await updateCertification(editingCertId, payload);
        showToast(`Certification "${certForm.title}" updated in MongoDB!`);
        setEditingCertId(null);
      } else {
        await addCertification(payload);
        showToast(`Certification "${certForm.title}" saved to MongoDB!`);
      }

      setCertForm({
        title: '',
        issuer: 'IBM SkillsBuild / Coursera',
        date: '2025',
        category: catKey,
        credentialId: '',
        skills: '',
        image: '',
        link: '',
      });
      fetchBackendData();
    } catch (err) {
      showToast('Error saving certification: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditCert = (cert) => {
    if (!requireAdminAuth('edit certification')) return;
    const cId = cert.id || cert._id;
    setEditingCertId(cId);
    // Prefer PDF file if certificate has an uploaded PDF, otherwise image/preview
    const existingFile = cert.file || '';
    const existingImg = cert.image || cert.preview || '';
    const isFilePdf =
      typeof existingFile === 'string' &&
      (existingFile.startsWith('data:application/pdf') ||
        existingFile.toLowerCase().endsWith('.pdf'));

    setCertForm({
      title: cert.title || '',
      issuer: cert.issuer || '',
      date: cert.date || '2025',
      category: cert.category || 'web',
      credentialId: cert.credentialId || '',
      skills: Array.isArray(cert.skills) ? cert.skills.join(', ') : cert.skills || '',
      image: isFilePdf && existingFile.startsWith('data:application/pdf')
        ? existingFile
        : existingImg || existingFile || '',
      link: existingFile || cert.link || '',
    });
    showToast(`Editing Certificate: "${cert.title}" — Update fields above & click Save Changes.`);
    setTimeout(() => {
      const formEl = document.getElementById('cert-admin-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = formEl.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus({ preventScroll: true });
      }
    }, 50);
  };

  const handleCancelEditCert = () => {
    setEditingCertId(null);
    setCertForm({
      title: '',
      issuer: 'IBM SkillsBuild / Coursera',
      date: '2025',
      category: 'web',
      credentialId: '',
      skills: '',
      image: '',
      link: '',
    });
  };

  const handleDeleteCert = async (cert) => {
    if (!requireAdminAuth('delete certification')) return;
    try {
      const cId = cert.id || cert._id || cert.title;
      await deleteCertification(cert);
      if (editingCertId && String(editingCertId) === String(cId)) {
        handleCancelEditCert();
      }
      if (previewCertificate && String(previewCertificate.id || previewCertificate._id) === String(cId)) {
        setPreviewCertificate(null);
      }
      showToast(`Certification "${cert.title}" deleted permanently from MongoDB & Portfolio!`);
      fetchBackendData();
    } catch (err) {
      showToast('Failed to delete certification: ' + err.message, true);
    }
  };

  // Handlers for Education (Category-wise Add, Edit & Delete)
  const handleAddEdu = async (e) => {
    e.preventDefault();
    if (!requireAdminAuth(editingEduId ? 'update education' : 'add education')) return;

    if (!eduForm.degree.trim() || !eduForm.institution.trim()) {
      showToast('Degree and Institution are required.', true);
      return;
    }
    setIsSubmitting(true);
    try {
      const highlightsList = eduForm.description
        ? Array.isArray(eduForm.description)
          ? eduForm.description
          : eduForm.description
              .split('\n')
              .map((d) => d.trim())
              .filter(Boolean)
        : [];
      const skillsList = eduForm.skills
        ? Array.isArray(eduForm.skills)
          ? eduForm.skills
          : eduForm.skills
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : [];

      const catKey = eduForm.category || 'engineering';
      const payload = {
        degree: eduForm.degree.trim(),
        institution: eduForm.institution.trim(),
        institute: eduForm.institution.trim(),
        location: eduForm.location.trim() || 'India',
        period: eduForm.period.trim(),
        duration: eduForm.period.trim(),
        grade: eduForm.grade.trim(),
        status: eduForm.status || 'Pursuing (Undergraduate)',
        category: catKey,
        categoryLabel: catKey === 'sciences' ? 'Mathematical Sciences' : 'Engineering & Technology',
        description: highlightsList,
        highlights: highlightsList,
        skills: skillsList,
      };

      if (editingEduId) {
        await updateEducation(editingEduId, payload);
        showToast('Education record updated in MongoDB!');
        setEditingEduId(null);
      } else {
        await addEducation(payload);
        showToast('Education record saved to MongoDB!');
      }

      setEduForm({
        degree: 'Bachelor of Technology in Computer Science & Engineering',
        institution: '',
        location: 'India',
        period: '2023 - 2027',
        grade: 'Current CGPA: 7.49',
        status: 'Pursuing (Undergraduate)',
        category: catKey,
        skills: 'C++, Python, Data Structures, Database Systems, AI/ML',
        description: '',
      });
      fetchBackendData();
    } catch (err) {
      showToast('Failed to save education: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditEdu = (edu) => {
    if (!requireAdminAuth('edit education')) return;
    const eId = edu.id || edu._id;
    setEditingEduId(eId);
    const highlightsArr =
      Array.isArray(edu.highlights) && edu.highlights.length > 0
        ? edu.highlights
        : Array.isArray(edu.description) && edu.description.length > 0
        ? edu.description
        : [];
    const descStr =
      highlightsArr.length > 0
        ? highlightsArr.join('\n')
        : typeof edu.description === 'string'
        ? edu.description
        : '';
    const skillsArr = Array.isArray(edu.skills) ? edu.skills : [];
    const skillsStr =
      skillsArr.length > 0
        ? skillsArr.join(', ')
        : typeof edu.skills === 'string'
        ? edu.skills
        : '';
    setEduForm({
      degree: edu.degree || '',
      institution: edu.institute || edu.institution || '',
      location: edu.location || 'India',
      period: edu.duration || edu.period || '',
      grade: edu.grade || '',
      status: edu.status || 'Completed (First Class)',
      category: edu.category || 'engineering',
      skills: skillsStr,
      description: descStr,
    });
    showToast(`Editing Education: "${edu.degree || edu.title}" — Make changes above & click Save Changes.`);
    setTimeout(() => {
      const formEl = document.getElementById('edu-admin-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = formEl.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus({ preventScroll: true });
      }
    }, 50);
  };

  const handleCancelEditEdu = () => {
    setEditingEduId(null);
    setEduForm({
      degree: 'Bachelor of Technology in Computer Science & Engineering',
      institution: '',
      location: 'India',
      period: '2023 - 2027',
      grade: 'Current CGPA: 7.49',
      status: 'Pursuing (Undergraduate)',
      category: 'engineering',
      skills: 'C++, Python, Data Structures, Database Systems, AI/ML',
      description: '',
    });
  };

  const handleDeleteEdu = async (edu) => {
    if (!requireAdminAuth('delete education')) return;
    try {
      await deleteEducation(edu.id || edu._id);
      if (editingEduId === (edu.id || edu._id)) {
        handleCancelEditEdu();
      }
      showToast(`Education "${edu.degree || edu.title}" deleted permanently from MongoDB & Portfolio!`);
      fetchBackendData();
    } catch (err) {
      showToast('Failed to delete education: ' + err.message, true);
    }
  };

  // Handlers for Experience (Category-wise Add, Edit & Delete with PDF Certificate support)
  const handleAddExp = async (e) => {
    e.preventDefault();
    if (!requireAdminAuth(editingExpId ? 'update experience' : 'add experience')) return;

    if (!expForm.role.trim() || !expForm.company.trim()) {
      showToast('Role and Company are required.', true);
      return;
    }
    setIsSubmitting(true);
    try {
      const bullets = Array.isArray(expForm.description)
        ? expForm.description.map((l) => String(l).trim()).filter(Boolean)
        : typeof expForm.description === 'string' && expForm.description.trim()
        ? expForm.description
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        : [];

      const skillTags = Array.isArray(expForm.skills)
        ? expForm.skills.map((s) => String(s).trim()).filter(Boolean)
        : typeof expForm.skills === 'string' && expForm.skills.trim()
        ? expForm.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const catKey = expForm.category || 'ai';
      const certFileUrl = (expForm.certificateFile || '').trim();
      const payload = {
        role: expForm.role.trim(),
        title: expForm.role.trim(),
        company: expForm.company.trim(),
        location: expForm.location.trim() || 'Remote',
        period: expForm.period.trim(),
        duration: expForm.period.trim(),
        category: catKey,
        categoryLabel: catKey === 'ai' ? 'AI & Machine Learning' : 'Web & Full Stack',
        skills: skillTags,
        tech: skillTags,
        description: bullets,
        details: bullets,
      };

      if (certFileUrl) {
        const isExpPdf =
          certFileUrl.startsWith('data:application/pdf') ||
          certFileUrl.toLowerCase().endsWith('.pdf') ||
          certFileUrl.toLowerCase().includes('.pdf?');
        const existingPreview =
          expForm.certificatePreview &&
          !expForm.certificatePreview.startsWith('data:application/pdf')
            ? expForm.certificatePreview
            : '';
        payload.certificate = {
          id: expForm.certificateId || `cert_${Date.now()}`,
          title:
            expForm.certificateTitle?.trim() ||
            `${expForm.role.trim()} - ${expForm.company.trim()} Certificate`,
          issuer: expForm.certificateIssuer?.trim() || expForm.company.trim(),
          date: expForm.certificateDate?.trim() || expForm.period.trim(),
          file: isExpPdf ? certFileUrl : '',
          preview: isExpPdf ? existingPreview : certFileUrl,
          image: isExpPdf ? existingPreview : certFileUrl,
        };
      } else {
        payload.certificate = null;
      }

      if (editingExpId) {
        await updateExperience(editingExpId, payload);
        showToast(`Experience at "${expForm.company}" updated in MongoDB!`);
        setEditingExpId(null);
      } else {
        await addExperience(payload);
        showToast(`Experience at "${expForm.company}" saved to MongoDB!`);
      }

      setExpForm({
        role: 'AI & Machine Learning Intern',
        company: '',
        location: 'Remote',
        period: '2025 - 2026',
        category: catKey,
        skills: 'Python, Machine Learning, Deep Learning',
        description: '',
        certificateId: '',
        certificateTitle: '',
        certificateIssuer: '',
        certificateDate: '',
        certificateFile: '',
        certificatePreview: '',
      });
      fetchBackendData();
    } catch (err) {
      showToast('Failed to save experience: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditExp = (exp) => {
    if (!requireAdminAuth('edit experience')) return;
    const eId = exp.id || exp._id;
    setEditingExpId(eId);
    const descArr =
      Array.isArray(exp.details) && exp.details.length > 0
        ? exp.details
        : Array.isArray(exp.description) && exp.description.length > 0
        ? exp.description
        : [];
    const descStr =
      descArr.length > 0
        ? descArr.join('\n')
        : typeof exp.description === 'string'
        ? exp.description
        : typeof exp.details === 'string'
        ? exp.details
        : '';
    const techArr =
      Array.isArray(exp.tech) && exp.tech.length > 0
        ? exp.tech
        : Array.isArray(exp.skills) && exp.skills.length > 0
        ? exp.skills
        : [];
    const skillsStr =
      techArr.length > 0
        ? techArr.join(', ')
        : typeof exp.skills === 'string'
        ? exp.skills
        : typeof exp.tech === 'string'
        ? exp.tech
        : '';
    const certObj = exp.certificate && typeof exp.certificate === 'object' ? exp.certificate : null;
    const certDoc =
      certObj?.file ||
      certObj?.image ||
      certObj?.preview ||
      (typeof exp.certificate === 'string' ? exp.certificate : '') ||
      '';
    setExpForm({
      role: exp.role || exp.title || '',
      company: exp.company || '',
      location: exp.location || 'Remote',
      period: exp.duration || exp.period || '',
      category:
        exp.category ||
        ((exp.role || exp.title || '').toLowerCase().includes('ai') ? 'ai' : 'web'),
      skills: skillsStr,
      description: descStr,
      certificateId: certObj?.id || '',
      certificateTitle: certObj?.title || '',
      certificateIssuer: certObj?.issuer || '',
      certificateDate: certObj?.date || '',
      certificateFile: certDoc,
      certificatePreview: certObj?.preview || '',
    });
    showToast(`Editing Experience: "${exp.role || exp.title}" at ${exp.company} — Update fields above & click Save Changes.`);
    setTimeout(() => {
      const formEl = document.getElementById('exp-admin-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const firstInput = formEl.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus({ preventScroll: true });
      }
    }, 50);
  };

  const handleCancelEditExp = () => {
    setEditingExpId(null);
    setExpForm({
      role: 'AI & Machine Learning Intern',
      company: '',
      location: 'Remote',
      period: '2025 - 2026',
      category: 'ai',
      skills: 'Python, Machine Learning, Deep Learning',
      description: '',
      certificateId: '',
      certificateTitle: '',
      certificateIssuer: '',
      certificateDate: '',
      certificateFile: '',
      certificatePreview: '',
    });
  };

  const handleDeleteExp = async (exp) => {
    if (!requireAdminAuth('delete experience')) return;
    try {
      await deleteExperience(exp.id || exp._id);
      if (editingExpId === (exp.id || exp._id)) {
        handleCancelEditExp();
      }
      showToast(`Experience at "${exp.company}" deleted permanently from MongoDB & Portfolio!`);
      fetchBackendData();
    } catch (err) {
      showToast('Failed to delete experience: ' + err.message, true);
    }
  };

  // Handlers for Skills (Domain Category-wise Add, Edit & Delete)
  const skillDomainTitles = {
    frontend: 'Frontend Development',
    backend: 'Backend & Cloud Databases',
    'ai-ml': 'AI, Machine Learning & Vision',
    'programming-languages': 'Programming Languages & Core CS',
    'tools-devops': 'DevOps & Developer Tools',
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!requireAdminAuth(editingSkillId ? 'update skill' : 'add skill')) return;

    if (!skillForm.name.trim()) {
      showToast('Skill name is required.', true);
      return;
    }
    setIsSubmitting(true);
    try {
      const isFeatured = Boolean(skillForm.featured || skillForm.highlight);
      const payload = {
        name: skillForm.name.trim(),
        domainId: skillForm.domainId || 'frontend',
        domainTitle: skillDomainTitles[skillForm.domainId] || 'Frontend Development',
        level: skillForm.level || 'Advanced',
        icon: (skillForm.icon || '').trim() || 'fas fa-check-circle',
        highlight: isFeatured,
        featured: isFeatured,
      };

      if (editingSkillId) {
        await updateSkill(editingSkillId, payload);
        showToast(`Skill "${skillForm.name}" updated in MongoDB!`);
        setEditingSkillId(null);
      } else {
        await addSkill(payload);
        showToast(`Skill "${skillForm.name}" added to ${payload.domainTitle}!`);
      }

      setSkillForm({
        name: '',
        domainId: skillForm.domainId || 'frontend',
        level: 'Advanced',
        icon: 'fas fa-code',
        highlight: false,
        featured: false,
      });
      fetchBackendData();
    } catch (err) {
      showToast('Failed to save skill: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditSkill = (skill, fallbackDomainId = 'frontend') => {
    if (!requireAdminAuth('edit skill')) return;
    const sId = skill.id || skill._id || skill.name;
    setEditingSkillId(sId);
    setSkillForm({
      name: skill.name || '',
      domainId: skill.domainId || fallbackDomainId || 'frontend',
      level: skill.level || 'Advanced',
      icon: skill.icon || 'fas fa-code',
      highlight: Boolean(skill.highlight || skill.featured),
      featured: Boolean(skill.featured || skill.highlight),
    });
    const formEl = document.getElementById('skill-admin-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEditSkill = () => {
    setEditingSkillId(null);
    setSkillForm({
      name: '',
      domainId: 'frontend',
      level: 'Advanced',
      icon: 'fas fa-code',
      highlight: false,
      featured: false,
    });
  };

  const handleDeleteSkill = async (skill) => {
    if (!requireAdminAuth('delete skill')) return;
    try {
      const sId = skill.id || skill._id || skill.name;
      await deleteSkill(skill);
      if (editingSkillId && String(editingSkillId) === String(sId)) {
        handleCancelEditSkill();
      }
      showToast(`Skill "${skill.name}" deleted permanently from MongoDB & Portfolio!`);
      fetchBackendData();
    } catch (err) {
      showToast('Failed to delete skill: ' + err.message, true);
    }
  };

  const handleUpdatePhotos = async (e) => {
    e.preventDefault();
    if (!requireAdminAuth('update profile photos')) return;
    setIsSubmitting(true);
    try {
      await updateProfilePhotos(photoForm);
      showToast('Profile and photos updated across Portfolio & MongoDB!');
    } catch (err) {
      showToast('Failed to update photos: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedAll = async () => {
    if (!requireAdminAuth('sync initial database records')) return;
    setIsSubmitting(true);
    try {
      await seedInitialData();
      showToast('Portfolio content synced to Cloud & MongoDB!');
      fetchBackendData();
    } catch (err) {
      showToast('Seeding error: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMessage = async (id) => {
    if (!requireAdminAuth('delete inquiry message')) return;
    try {
      setContactMessages((prev) => prev.filter((m) => String(m.id || m._id) !== String(id)));
      if (deleteContactMessage) {
        await deleteContactMessage(id);
      } else {
        const res = await fetch(buildApiUrl(`/api/contact/messages/${encodeURIComponent(id)}`), {
          method: 'DELETE',
          headers: getDeleteHeaders(),
        });
        if (!res.ok) {
          throw new Error('Failed to delete inquiry from database.');
        }
      }
      showToast('Inquiry deleted permanently from MongoDB!');
      fetchBackendData();
    } catch (err) {
      fetchContactMessages();
      showToast('Failed to delete message: ' + (err?.message || ''), true);
    }
  };

  const handleMarkMessageRead = async (id) => {
    try {
      setContactMessages((prev) =>
        prev.map((m) => (String(m.id || m._id) === String(id) ? { ...m, status: 'read' } : m))
      );
      if (markContactMessageRead) {
        await markContactMessageRead(id);
      } else {
        await fetch(buildApiUrl(`/api/contact/messages/${encodeURIComponent(id)}/read`), {
          method: 'PATCH',
        });
      }
      fetchBackendData();
    } catch {
      // ignore
    }
  };

  const filteredProjects = projectsList.filter((p) => {
    const matchesSearch =
      !projectSearch.trim() ||
      p.title?.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.description?.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.technologies?.some((t) => t.toLowerCase().includes(projectSearch.toLowerCase()));
    if (projectCategoryFilter === 'All') return matchesSearch;
    const catLower = (p.category || '').toLowerCase();
    const filterLower = projectCategoryFilter.toLowerCase();
    const techMatch = (p.technologies || p.tags || []).some(
      (t) => t.toLowerCase() === filterLower || t.toLowerCase().includes(filterLower)
    );
    const catMatch =
      p.category === projectCategoryFilter ||
      catLower.includes(filterLower) ||
      (projectCategoryFilter === 'React' && catLower.includes('frontend')) ||
      (projectCategoryFilter === 'Machine Learning' &&
        (catLower.includes('ai') || catLower.includes('vision'))) ||
      (projectCategoryFilter === 'Backend' &&
        (catLower.includes('full stack') ||
          catLower.includes('mern') ||
          catLower.includes('backend')));
    return matchesSearch && (catMatch || techMatch);
  });

  const filteredCerts = certificationsList.filter((c) => {
    if (certCategoryFilter === 'all') return true;
    return (c.category || 'other') === certCategoryFilter;
  });

  const filteredEdu = educationList.filter((edu) => {
    if (eduCategoryFilter === 'all') return true;
    const cat =
      edu.category ||
      ((edu.degree || '').toLowerCase().includes('b.sc') ? 'sciences' : 'engineering');
    return cat === eduCategoryFilter;
  });

  const filteredExp = experienceList.filter((exp) => {
    if (expCategoryFilter === 'all') return true;
    const cat =
      exp.category ||
      ((exp.role || exp.title || '').toLowerCase().includes('ai') ? 'ai' : 'web');
    return cat === expCategoryFilter;
  });

  const filteredSkillCategories = (skillCategories || []).filter((cat) => {
    if (skillCategoryFilter === 'all') return true;
    return cat.id === skillCategoryFilter;
  });

  const totalSkillsCount =
    (skillCategories || []).reduce((sum, cat) => sum + (cat.skills?.length || 0), 0) ||
    customSkills.length;

  const counts = {
    projects: projectsList.length,
    certifications: certificationsList.length,
    education: educationList.length,
    skills: totalSkillsCount,
    experience: experienceList.length,
    messages: contactMessages.length,
    auditLogs: auditStats?.total || auditLogs.length,
  };

  const CERT_CATEGORY_LABELS = {
    web: 'Web Development',
    ai: 'AI & Machine Learning',
    isro: 'ISRO Certifications',
    internship: 'Internship Certifications',
    other: 'Other Courses',
  };

  return (
    <div className="admin-portal-page">
      {/* Top Header Bar */}
      <AdminTopBar
        onNavigateToFrontend={onNavigateToFrontend}
        isBackendConnected={isBackendConnected}
        backendHealth={backendHealth}
        isAdmin={isAdmin}
        currentUser={currentUser}
        dbUser={dbUser}
        logoutAdmin={logoutAdmin}
        loginWithGoogle={loginWithGoogle}
        isSigningIn={isSigningIn}
        setDevAdminBypass={setDevAdminBypass}
        showToast={showToast}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
      />

      {/* Toast Alert */}
      {statusMessage && (
        <aside
          aria-live="polite"
          className={`admin-portal-toast ${statusMessage.isError ? 'error' : 'success'}`}
        >
          {statusMessage.isError ? <span className="toast-icon">⚠️</span> : <CheckCircle2 size={16} />}
          <span>{statusMessage.text}</span>
        </aside>
      )}

      {/* Main Layout: Sidebar Navigation + Content Area */}
      <div className="admin-portal-layout">
        {/* Modular Sidebar */}
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          counts={counts}
          handleSeedAll={handleSeedAll}
          isSubmitting={isSubmitting}
        />

        {/* Dynamic Content Panel */}
        <main className="admin-portal-content">
          {/* Read-Only Lock Banner when not authenticated */}
          {!isAdmin && (
            <div className="admin-auth-lock-banner">
              <div className="admin-auth-lock-info">
                <div className="admin-auth-lock-icon">
                  <Lock size={18} />
                </div>
                <div>
                  <strong>Read-Only Mode — Admin Login Required</strong>
                  <span>
                    Sign in with your Admin credentials to Add, Edit, or Delete portfolio records in the database.
                  </span>
                </div>
              </div>
              <div className="admin-auth-lock-actions">
                <button
                  type="button"
                  className="btn-lock-signin"
                  onClick={() => setIsAuthModalOpen(true)}
                >
                  <LogIn size={14} />
                  <span>Admin Login</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: DASHBOARD & METRICS */}
          {activeTab === 'dashboard' && (
            <div className="admin-dashboard-view">
              <div className="dashboard-welcome-banner">
                <div>
                  <h2>Portfolio Admin Control Panel</h2>
                  <p>
                    Full Node.js &amp; MongoDB document management: Create, update, photo swap, and delete records with live database synchronization.
                  </p>
                </div>
                <div className="quick-action-cluster">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setActiveTab('projects')}
                  >
                    <Plus size={16} /> Add Project
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setActiveTab('photos')}
                  >
                    <Image size={16} /> Change Photos
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="portal-metrics-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <span>Total Page Views</span>
                    <Activity size={18} className="text-accent" />
                  </div>
                  <div className="metric-value">{apiStats.pageViews}</div>
                  <div className="metric-footer text-green">
                    <Check size={14} /> Node.js Express REST Tracker
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Projects</span>
                    <FolderGit2 size={18} className="text-accent" />
                  </div>
                  <div className="metric-value">{projectsList.length}</div>
                  <div className="metric-footer">
                    <span>{projectsList.filter((p) => p.featured).length} Featured on Frontend</span>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Certifications</span>
                    <Award size={18} className="text-accent" />
                  </div>
                  <div className="metric-value">{certificationsList.length}</div>
                  <div className="metric-footer">Verified credentials &amp; badges</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <span>Contact Inquiries</span>
                    <Mail size={18} className="text-accent" />
                  </div>
                  <div className="metric-value">{contactMessages.length}</div>
                  <div className="metric-footer text-orange">
                    {contactMessages.filter((m) => m.status === 'unread').length} unread in MongoDB
                  </div>
                </div>

                <div
                  className="metric-card clickable"
                  onClick={() => setActiveTab('seo-generator')}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="metric-header">
                    <span>SEO &amp; Social Cards</span>
                    <Globe size={18} className="text-accent" />
                  </div>
                  <div className="metric-value">
                    {projectsList.filter((p) => p.seo?.metaTitle).length} / {projectsList.length}
                  </div>
                  <div className="metric-footer text-green">
                    <Sparkles size={14} /> Automated Meta Generator →
                  </div>
                </div>
              </div>

              {/* Quick Summary Grid */}
              <div className="dashboard-sections-summary">
                <div className="summary-box">
                  <div className="summary-box-header">
                    <h3>Recent Projects</h3>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setActiveTab('projects')}
                    >
                      View All →
                    </button>
                  </div>
                  <ul className="summary-list">
                    {projectsList.slice(0, 4).map((p) => (
                      <li key={p.id || p._id} className="summary-item">
                        <span className="summary-item-title">{p.title}</span>
                        <span className="summary-item-meta">{p.category}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="summary-box">
                  <div className="summary-box-header">
                    <h3>Recent Inquiries (MongoDB)</h3>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setActiveTab('messages')}
                    >
                      View Inbox →
                    </button>
                  </div>
                  {contactMessages.length > 0 ? (
                    <ul className="summary-list">
                      {contactMessages.slice(0, 3).map((m) => (
                        <li key={m.id || m._id} className="summary-item">
                          <div>
                            <strong className="summary-item-title">{m.name}</strong>
                            <p className="summary-item-snippet">{m.subject}</p>
                          </div>
                          <span className="summary-date">
                            {new Date(m.timestamp).toLocaleDateString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="empty-subtext">No inquiries received yet.</p>
                  )}
                </div>

                <div className="summary-box">
                  <div className="summary-box-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <History size={16} className="text-accent" />
                      <h3>Recent Audit Trail</h3>
                    </div>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => setActiveTab('audit-logs')}
                    >
                      View All ({auditStats?.total || auditLogs.length}) →
                    </button>
                  </div>
                  {auditLogs.length > 0 ? (
                    <ul className="summary-list">
                      {auditLogs.slice(0, 4).map((log) => {
                        const actionClass =
                          log.action === 'CREATE'
                            ? 'create'
                            : log.action === 'UPDATE'
                            ? 'update'
                            : 'delete';
                        return (
                          <li key={log.id} className="summary-item">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <span className={`admin-audit-action-badge ${actionClass}`}>
                                {log.action}
                              </span>
                              <span className="summary-item-title">{log.targetTitle}</span>
                            </div>
                            <span className="summary-item-meta">
                              @{log.changedBy?.username || 'admin'}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="empty-subtext">
                      No changes recorded yet. Add or edit a project/experience to see audit logs.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROJECTS MANAGER */}
          {activeTab === 'projects' && (
            <div className="admin-projects-view">
              <div className="view-header-bar">
                <div>
                  <h2>Projects Manager (Category-Wise)</h2>
                  <p>
                    Add, edit, and delete engineering projects across Frontend, Full Stack, AI/ML, and Backend categories.
                  </p>
                </div>
                <div className="view-search-controls">
                  <div className="search-input-box">
                    <Search size={15} />
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                  </div>
                  <select
                    value={projectCategoryFilter}
                    onChange={(e) => setProjectCategoryFilter(e.target.value)}
                    className="select-filter"
                  >
                    <option value="All">All Projects ({projectsList.length})</option>
                    <option value="React">React / Frontend</option>
                    <option value="Machine Learning">Machine Learning / AI</option>
                    <option value="Backend">Backend / Full Stack</option>
                    <option value="Frontend & UI Engineering">Frontend &amp; UI Engineering</option>
                    <option value="Full Stack & MERN Architecture">Full Stack &amp; MERN Architecture</option>
                    <option value="Computer Vision & AI/ML">Computer Vision &amp; AI/ML</option>
                  </select>
                </div>
              </div>

              {/* Styled Category Filter Pills matching Portfolio Frontend */}
              <div className="admin-category-filter-bar">
                {['All', 'React', 'Machine Learning', 'Backend'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setProjectCategoryFilter(cat)}
                    className={`admin-category-pill ${projectCategoryFilter === cat ? 'active' : ''}`}
                  >
                    {cat === 'All' ? `All Projects (${projectsList.length})` : cat}
                  </button>
                ))}
              </div>

              {/* Add / Edit Project Form */}
              <form id="project-admin-form" onSubmit={handleAddProject} className="admin-card-form">
                <div className="form-header-bar">
                  <h3 className="form-legend">
                    {editingProjectId ? (
                      <>
                        <Edit3 size={16} className="text-accent" /> Edit Project (Updating MongoDB)
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Add New Project to Database
                      </>
                    )}
                  </h3>
                  {editingProjectId && (
                    <span className="editing-badge">Editing ID: {editingProjectId}</span>
                  )}
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Project Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. AI Powered Analytics Dashboard"
                      value={projectForm.title}
                      onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={projectForm.category}
                      onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}
                    >
                      <option value="Frontend & UI Engineering">Frontend &amp; UI Engineering (React)</option>
                      <option value="Full Stack & MERN Architecture">Full Stack &amp; MERN Architecture (Backend)</option>
                      <option value="Computer Vision & AI/ML">Computer Vision &amp; AI/ML (Machine Learning)</option>
                      <option value="Backend & Cloud Architecture">Backend &amp; Cloud Architecture</option>
                      <option value="Full Stack">Full Stack</option>
                      <option value="AI / ML">AI / ML</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    rows={3}
                    placeholder="Describe problem solved, technical architecture, and impact..."
                    value={projectForm.description}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, description: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Technologies / Filter Tags (comma separated)</label>
                    <input
                      type="text"
                      placeholder="React, Machine Learning, Backend, Node.js, Python"
                      value={projectForm.technologies}
                      onChange={(e) =>
                        setProjectForm({ ...projectForm, technologies: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>GitHub Repository URL</label>
                    <input
                      type="url"
                      placeholder="https://github.com/..."
                      value={projectForm.github}
                      onChange={(e) =>
                        setProjectForm({ ...projectForm, github: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Live Demo URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={projectForm.live}
                      onChange={(e) => setProjectForm({ ...projectForm, live: e.target.value })}
                    />
                  </div>
                </div>

                {/* File Upload Zone for Project Thumbnail */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <FileUploadZone
                    label="Project Thumbnail / Banner Image (JPG, PNG, WebP)"
                    accept="image/*"
                    value={projectForm.image}
                    onChange={(url) => setProjectForm({ ...projectForm, image: url })}
                    helpText="Upload a crisp screenshot or thumbnail (Base64 stored in MongoDB)"
                  />
                </div>

                <div className="form-group checkbox-group" style={{ marginBottom: '1.25rem' }}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={projectForm.featured}
                      onChange={(e) =>
                        setProjectForm({ ...projectForm, featured: e.target.checked })
                      }
                    />
                    <span>Mark as Featured Project on Frontend</span>
                  </label>
                </div>

                <div className="form-submit-footer">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving to MongoDB...'
                      : editingProjectId
                      ? 'Save Changes to MongoDB'
                      : 'Publish Project'}
                  </button>
                  {editingProjectId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEditProject}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {/* Projects Grid Display */}
              <div className="projects-admin-grid">
                {filteredProjects.map((proj) => (
                  <div key={proj.id || proj._id} className="project-admin-card">
                    <div className="card-media-banner">
                      <img
                        src={proj.image || '/assets/aistudio/projects-bg_f9111c06.png'}
                        alt={proj.title}
                        className="proj-thumb"
                      />
                      {proj.featured && <span className="featured-badge">Featured</span>}
                      <span className="category-tag">{proj.category}</span>
                    </div>

                    <div className="card-body">
                      <h4>{proj.title}</h4>
                      <p className="card-desc">{proj.description}</p>

                      <div className="tech-tags-list">
                        {(proj.technologies || proj.tags || []).map((tech, idx) => (
                          <span key={idx} className="tech-badge">
                            {tech}
                          </span>
                        ))}
                      </div>

                      <div className="card-action-bar">
                        <div className="links-group">
                          {(proj.github || proj.githubLink) && (
                            <a
                              href={proj.github || proj.githubLink}
                              target="_blank"
                              rel="noreferrer"
                              className="action-icon-link"
                              title="GitHub Repo"
                            >
                              <i className="fab fa-github"></i>
                            </a>
                          )}
                          {(proj.live || proj.demoLink) && (
                            <a
                              href={proj.live || proj.demoLink}
                              target="_blank"
                              rel="noreferrer"
                              className="action-icon-link"
                              title="Live Demo"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                        <div className="card-right-actions">
                          <button
                            type="button"
                            className="btn-card-edit-action"
                            onClick={() => handleStartEditProject(proj)}
                            title="Edit Project in MongoDB"
                          >
                            <Pencil size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn-card-seo-action"
                            onClick={() => setActiveTab('seo-generator')}
                            title="Edit SEO Meta Tags and Social Previews for this project"
                          >
                            <Globe size={13} />
                            <span>SEO &amp; Social</span>
                          </button>
                          <button
                            type="button"
                            className="btn-delete-card"
                            onClick={() => handleDeleteProject(proj)}
                            title="Delete Project"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: AUTOMATED SEO & SOCIAL META GENERATOR */}
          {activeTab === 'seo-generator' && (
            <ProjectSeoGeneratorTab
              projectsList={projectsList}
              onUpdateProjectSEO={async (projId, seoData) => {
                if (!requireAdminAuth('save project SEO metadata')) return false;
                return updateProjectSEO(projId, seoData);
              }}
              profileConfig={profileConfig}
            />
          )}

          {/* TAB 3: CERTIFICATIONS */}
          {activeTab === 'certifications' && (
            <div className="admin-certs-view">
              <div className="view-header-bar">
                <div>
                  <h2>Certifications Manager (Category-Wise)</h2>
                  <p>
                    Add, edit, preview PDF/Image, and delete credentials across Web Dev, AI &amp; ML, ISRO, Internships, and Other categories.
                  </p>
                </div>
              </div>

              {/* Styled Category Filter Bar matching Portfolio Frontend */}
              <div className="admin-category-filter-bar">
                {[
                  { id: 'all', label: `All (${certificationsList.length})` },
                  {
                    id: 'web',
                    label: `Web Dev (${certificationsList.filter((c) => c.category === 'web').length})`,
                  },
                  {
                    id: 'ai',
                    label: `AI & ML (${certificationsList.filter((c) => c.category === 'ai').length})`,
                  },
                  {
                    id: 'isro',
                    label: `ISRO (${certificationsList.filter((c) => c.category === 'isro').length})`,
                  },
                  {
                    id: 'internship',
                    label: `Internships (${certificationsList.filter((c) => c.category === 'internship').length})`,
                  },
                  {
                    id: 'other',
                    label: `Other (${certificationsList.filter((c) => !c.category || c.category === 'other').length})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCertCategoryFilter(tab.id)}
                    className={`admin-category-pill ${certCategoryFilter === tab.id ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add / Edit Certification Form */}
              <form id="cert-admin-form" onSubmit={handleAddCert} className="admin-card-form">
                <div className="form-header-bar">
                  <h3 className="form-legend">
                    {editingCertId ? (
                      <>
                        <Edit3 size={16} className="text-accent" /> Edit Certificate (Updating MongoDB)
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Add Certification to Database
                      </>
                    )}
                  </h3>
                  {editingCertId && (
                    <span className="editing-badge">Editing ID: {editingCertId}</span>
                  )}
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Certification Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Deep Learning Specialization"
                      value={certForm.title}
                      onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Issuer *</label>
                    <input
                      type="text"
                      placeholder="DeepLearning.AI / Coursera / ISRO"
                      value={certForm.issuer}
                      onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={certForm.category || 'web'}
                      onChange={(e) => setCertForm({ ...certForm, category: e.target.value })}
                    >
                      <option value="web">Web Development Certifications</option>
                      <option value="ai">Artificial Intelligence Certifications</option>
                      <option value="isro">ISRO Certifications</option>
                      <option value="internship">Internship Certifications</option>
                      <option value="other">Other Course Certifications</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Year / Date</label>
                    <input
                      type="text"
                      placeholder="e.g. July 2024 or 2025"
                      value={certForm.date}
                      onChange={(e) => setCertForm({ ...certForm, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Credential ID</label>
                    <input
                      type="text"
                      placeholder="e.g. DLAI-984729"
                      value={certForm.credentialId}
                      onChange={(e) =>
                        setCertForm({ ...certForm, credentialId: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Verification Link / PDF URL (optional)</label>
                    <input
                      type="text"
                      placeholder="https://... or /certificates/..."
                      value={certForm.link}
                      onChange={(e) => setCertForm({ ...certForm, link: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Skills / Competencies (comma separated)</label>
                  <input
                    type="text"
                    placeholder="PyTorch, CNN, RNN, Transformers, Deep Learning"
                    value={certForm.skills}
                    onChange={(e) => setCertForm({ ...certForm, skills: e.target.value })}
                  />
                </div>

                {/* File Upload Zone for Certificate (JPG / PNG / PDF) */}
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <FileUploadZone
                    label="Certificate Document (Upload PDF or JPG/PNG Image)"
                    allowPdf={true}
                    value={certForm.image}
                    onChange={(url) => setCertForm({ ...certForm, image: url })}
                    helpText="Upload certificate PDF or Image (JPG/PNG) — PDF viewer opens directly on both Admin & Portfolio"
                  />
                </div>

                <div className="form-submit-footer">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving to MongoDB...'
                      : editingCertId
                      ? 'Save Changes to MongoDB'
                      : 'Add Certification'}
                  </button>
                  {editingCertId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEditCert}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              <div className="certs-admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Issuer</th>
                      <th>Year / Date</th>
                      <th>Document / Preview</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCerts.map((cert) => {
                      const docSource = cert.file || cert.image || cert.preview || '';
                      const isPdfDoc =
                        typeof docSource === 'string' &&
                        (docSource.startsWith('data:application/pdf') ||
                          docSource.toLowerCase().endsWith('.pdf') ||
                          (typeof cert.image === 'string' &&
                            cert.image.startsWith('data:application/pdf')));
                      const catKey = cert.category || 'other';

                      return (
                        <tr key={cert.id || cert._id}>
                          <td data-label="Title">
                            <strong>{cert.title}</strong>
                          </td>
                          <td data-label="Category">
                            <span className="admin-category-badge">
                              {CERT_CATEGORY_LABELS[catKey] || catKey}
                            </span>
                          </td>
                          <td data-label="Issuer">{cert.issuer}</td>
                          <td data-label="Year / Date">{cert.date}</td>
                          <td data-label="Preview">
                            {docSource ? (
                              <button
                                type="button"
                                className="table-doc-pill"
                                onClick={() => setPreviewCertificate(cert)}
                                title="Click to preview PDF or Image Certificate"
                                style={{ cursor: 'pointer', background: 'none' }}
                              >
                                {isPdfDoc ? (
                                  <FileText size={13} style={{ color: '#f87171' }} />
                                ) : (
                                  <Eye size={13} style={{ color: '#38bdf8' }} />
                                )}
                                <span>{isPdfDoc ? 'View PDF' : 'View Cert'}</span>
                              </button>
                            ) : cert.link ? (
                              <a
                                href={cert.link}
                                target="_blank"
                                rel="noreferrer"
                                className="table-link"
                              >
                                Verify <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td data-label="Action">
                            <div className="table-actions-cell">
                              <button
                                type="button"
                                className="btn-table-edit"
                                onClick={() => handleStartEditCert(cert)}
                                title="Edit Certificate in MongoDB"
                              >
                                <Pencil size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                className="btn-table-delete"
                                onClick={() => handleDeleteCert(cert)}
                                title="Delete Certificate"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EDUCATION */}
          {activeTab === 'education' && (
            <div className="admin-education-view">
              <div className="view-header-bar">
                <div>
                  <h2>Education Manager (Category-Wise)</h2>
                  <p>
                    Manage academic degrees across Engineering &amp; Technology and Mathematical Sciences categories.
                  </p>
                </div>
              </div>

              {/* Styled Category Filter Bar matching Portfolio Frontend */}
              <div className="admin-category-filter-bar">
                {[
                  { id: 'all', label: `All (${educationList.length})` },
                  {
                    id: 'engineering',
                    label: `Engineering & Technology (${
                      educationList.filter((e) => (e.category || 'engineering') === 'engineering')
                        .length
                    })`,
                  },
                  {
                    id: 'sciences',
                    label: `Mathematical Sciences (${
                      educationList.filter(
                        (e) =>
                          e.category === 'sciences' ||
                          (e.degree || '').toLowerCase().includes('b.sc')
                      ).length
                    })`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEduCategoryFilter(tab.id)}
                    className={`admin-category-pill ${eduCategoryFilter === tab.id ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add / Edit Education Form */}
              <form id="edu-admin-form" onSubmit={handleAddEdu} className="admin-card-form">
                <div className="form-header-bar">
                  <h3 className="form-legend">
                    {editingEduId ? (
                      <>
                        <Edit3 size={16} className="text-accent" /> Edit Education (Updating MongoDB)
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Add Degree / Education to Database
                      </>
                    )}
                  </h3>
                  {editingEduId && <span className="editing-badge">Editing ID: {editingEduId}</span>}
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Degree / Qualification *</label>
                    <input
                      type="text"
                      placeholder="B.Tech in Computer Science & Engineering"
                      value={eduForm.degree}
                      onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Institution / University *</label>
                    <input
                      type="text"
                      placeholder="University Name"
                      value={eduForm.institution}
                      onChange={(e) => setEduForm({ ...eduForm, institution: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Academic Category *</label>
                    <select
                      value={eduForm.category || 'engineering'}
                      onChange={(e) => setEduForm({ ...eduForm, category: e.target.value })}
                    >
                      <option value="engineering">Engineering &amp; Technology</option>
                      <option value="sciences">Mathematical Sciences</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Period / Years</label>
                    <input
                      type="text"
                      placeholder="2023 – 2027"
                      value={eduForm.period}
                      onChange={(e) => setEduForm({ ...eduForm, period: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Grade / CGPA</label>
                    <input
                      type="text"
                      placeholder="CGPA: 7.5+ (Current)"
                      value={eduForm.grade}
                      onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <input
                      type="text"
                      placeholder="Pursuing (Undergraduate) or Completed (First Class)"
                      value={eduForm.status || ''}
                      onChange={(e) => setEduForm({ ...eduForm, status: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Core Subjects / Skills Tags (comma separated)</label>
                    <input
                      type="text"
                      placeholder="Data Structures & Algorithms, Operating Systems, DBMS, AI & Machine Learning"
                      value={eduForm.skills || ''}
                      onChange={(e) => setEduForm({ ...eduForm, skills: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Location</label>
                    <input
                      type="text"
                      placeholder="Jaipur, Rajasthan, India"
                      value={eduForm.location}
                      onChange={(e) => setEduForm({ ...eduForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Coursework / Key Highlights (one bullet per line)</label>
                  <textarea
                    rows={3}
                    placeholder="Pursuing Bachelor of Technology with focus on software engineering&#10;Active participant in technical hackathons and coding competitions"
                    value={eduForm.description}
                    onChange={(e) => setEduForm({ ...eduForm, description: e.target.value })}
                  />
                </div>

                <div className="form-submit-footer">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving to MongoDB...'
                      : editingEduId
                      ? 'Save Changes to MongoDB'
                      : 'Add Education'}
                  </button>
                  {editingEduId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEditEdu}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              <div className="items-simple-list">
                {filteredEdu.map((edu) => {
                  const bullets =
                    Array.isArray(edu.highlights) && edu.highlights.length > 0
                      ? edu.highlights
                      : Array.isArray(edu.details) && edu.details.length > 0
                      ? edu.details
                      : edu.description
                      ? String(edu.description)
                          .split('\n')
                          .filter(Boolean)
                      : [];
                  const skillTags =
                    Array.isArray(edu.skills) && edu.skills.length > 0
                      ? edu.skills
                      : Array.isArray(edu.tech)
                      ? edu.tech
                      : [];
                  const eduCat =
                    edu.category ||
                    ((edu.degree || '').toLowerCase().includes('b.sc')
                      ? 'sciences'
                      : 'engineering');

                  return (
                    <div key={edu.id || edu._id} className="simple-list-card">
                      <div className="simple-list-info">
                        <div className="admin-card-title-row">
                          <h4>{edu.degree || edu.title}</h4>
                          <span className="admin-category-badge">
                            {eduCat === 'sciences'
                              ? 'Mathematical Sciences'
                              : 'Engineering & Technology'}
                          </span>
                          {edu.status && (
                            <span className="admin-status-badge">{edu.status}</span>
                          )}
                        </div>
                        <div className="simple-list-sub">
                          <strong>{edu.institution || edu.company}</strong> ·{' '}
                          <span>{edu.period || edu.duration}</span>
                          {edu.location ? ` · ${edu.location}` : ''}
                        </div>
                        {edu.grade && <div className="simple-grade-pill">{edu.grade}</div>}
                        {bullets.length > 0 && (
                          <ul className="exp-bullets" style={{ marginTop: '8px' }}>
                            {bullets.map((b, idx) => (
                              <li key={idx}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {skillTags.length > 0 && (
                          <div className="card-tech-chips" style={{ marginTop: '8px' }}>
                            {skillTags.map((t, idx) => (
                              <span key={idx} className="tech-chip">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="simple-card-actions">
                        <button
                          type="button"
                          className="btn-edit-simple-card"
                          onClick={() => handleStartEditEdu(edu)}
                          title="Edit Education in MongoDB"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-delete-card"
                          onClick={() => handleDeleteEdu(edu)}
                          title="Delete Education"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: SKILLS */}
          {activeTab === 'skills' && (
            <div className="admin-skills-view">
              <div className="view-header-bar">
                <div>
                  <h2>Skills Matrix Manager (Category-Wise)</h2>
                  <p>
                    Add, edit, and delete skills across all 5 Portfolio Frontend technical domains ({totalSkillsCount} total skills).
                  </p>
                </div>
              </div>

              {/* Styled Domain Filter Bar matching Portfolio Frontend */}
              <div className="admin-category-filter-bar">
                {[
                  { id: 'all', label: `All Domains (${totalSkillsCount})` },
                  ...(skillCategories || []).map((cat) => ({
                    id: cat.id,
                    label: `${cat.title} (${cat.skills?.length || 0})`,
                  })),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSkillCategoryFilter(tab.id)}
                    className={`admin-category-pill ${skillCategoryFilter === tab.id ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add / Edit Skill Form */}
              <form id="skill-admin-form" onSubmit={handleAddSkill} className="admin-card-form">
                <div className="form-header-bar">
                  <h3 className="form-legend">
                    {editingSkillId ? (
                      <>
                        <Edit3 size={16} className="text-accent" /> Edit Skill (Updating MongoDB)
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Add Skill to Domain Category
                      </>
                    )}
                  </h3>
                  {editingSkillId && (
                    <span className="editing-badge">Editing ID: {editingSkillId}</span>
                  )}
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Skill Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. React.js, Next.js, TensorFlow, Docker"
                      value={skillForm.name}
                      onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Category / Technical Domain *</label>
                    <select
                      value={skillForm.domainId}
                      onChange={(e) => setSkillForm({ ...skillForm, domainId: e.target.value })}
                    >
                      <option value="frontend">Frontend Development</option>
                      <option value="backend">Backend &amp; Cloud Databases</option>
                      <option value="ai-ml">AI, Machine Learning &amp; Vision</option>
                      <option value="programming-languages">Programming Languages &amp; Core CS</option>
                      <option value="tools-devops">DevOps &amp; Developer Tools</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Proficiency Level</label>
                    <select
                      value={skillForm.level}
                      onChange={(e) => setSkillForm({ ...skillForm, level: e.target.value })}
                    >
                      <option value="Expert">Expert</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Proficient">Proficient</option>
                      <option value="Intermediate">Intermediate</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
                  <div className="form-group">
                    <label>FontAwesome Icon Class (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. fab fa-react, fab fa-python, fas fa-database"
                      value={skillForm.icon || 'fas fa-code'}
                      onChange={(e) => setSkillForm({ ...skillForm, icon: e.target.value })}
                    />
                  </div>
                  <div
                    className="form-group checkbox-group"
                    style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}
                  >
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={Boolean(skillForm.featured || skillForm.highlight)}
                        onChange={(e) =>
                          setSkillForm({
                            ...skillForm,
                            featured: e.target.checked,
                            highlight: e.target.checked,
                          })
                        }
                      />
                      <span>Mark as Core / Featured Skill (★ Star Badge on Frontend)</span>
                    </label>
                  </div>
                </div>

                <div className="form-submit-footer">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving to MongoDB...'
                      : editingSkillId
                      ? 'Save Changes to MongoDB'
                      : 'Add Skill'}
                  </button>
                  {editingSkillId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEditSkill}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              {/* Category-wise Skills Cards matching Portfolio Frontend */}
              <div className="admin-skills-domain-stack">
                {filteredSkillCategories.map((category) => (
                  <div key={category.id} className="custom-skills-summary-box">
                    <div className="admin-skill-domain-header">
                      <h4 className="admin-skill-domain-title">
                        <i className={category.icon}></i>
                        <span>{category.title}</span>
                        <span className="admin-skill-domain-count">
                          {category.skills?.length || 0} skills
                        </span>
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setSkillForm((prev) => ({ ...prev, domainId: category.id }));
                          const formEl = document.getElementById('skill-admin-form');
                          if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        className="btn-add-domain-skill"
                      >
                        <Plus size={13} />
                        <span>Add to {category.title}</span>
                      </button>
                    </div>
                    {category.skills && category.skills.length > 0 ? (
                      <div className="skills-chips-rail">
                        {category.skills.map((s) => (
                          <span key={s.id || s._id || s.name} className="admin-skill-chip">
                            <i
                              className={s.icon || 'fas fa-code'}
                              style={{ color: '#38bdf8', fontSize: '0.78rem', marginRight: '0.25rem' }}
                            ></i>
                            <span>{s.name}</span>
                            {(s.featured || s.highlight) && (
                              <span className="admin-skill-star" title="Core Skill">
                                ★
                              </span>
                            )}
                            <small>({s.level})</small>
                            <button
                              type="button"
                              onClick={() => handleStartEditSkill({ ...s, domainId: category.id })}
                              className="chip-edit"
                              title="Edit Skill in MongoDB"
                            >
                              <Pencil size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSkill(s)}
                              className="chip-remove"
                              title="Delete Skill"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-subtext">No skills in this category yet.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: EXPERIENCE */}
          {activeTab === 'experience' && (
            <div className="admin-experience-view">
              <div className="view-header-bar">
                <div>
                  <h2>Experience Manager (Category-Wise)</h2>
                  <p>
                    Manage internships and engineering positions across AI &amp; Machine Learning and Web &amp; Full Stack categories.
                  </p>
                </div>
              </div>

              {/* Styled Category Filter Bar matching Portfolio Frontend */}
              <div className="admin-category-filter-bar">
                {[
                  { id: 'all', label: `All Experience (${experienceList.length})` },
                  {
                    id: 'ai',
                    label: `AI & Machine Learning (${
                      experienceList.filter(
                        (e) =>
                          (e.category ||
                            ((e.role || e.title || '').toLowerCase().includes('ai')
                              ? 'ai'
                              : 'web')) === 'ai'
                      ).length
                    })`,
                  },
                  {
                    id: 'web',
                    label: `Web & Full Stack (${
                      experienceList.filter(
                        (e) =>
                          (e.category ||
                            ((e.role || e.title || '').toLowerCase().includes('ai')
                              ? 'ai'
                              : 'web')) === 'web'
                      ).length
                    })`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setExpCategoryFilter(tab.id)}
                    className={`admin-category-pill ${expCategoryFilter === tab.id ? 'active' : ''}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Add / Edit Experience Form */}
              <form id="exp-admin-form" onSubmit={handleAddExp} className="admin-card-form">
                <div className="form-header-bar">
                  <h3 className="form-legend">
                    {editingExpId ? (
                      <>
                        <Edit3 size={16} className="text-accent" /> Edit Experience (Updating MongoDB)
                      </>
                    ) : (
                      <>
                        <Plus size={16} /> Add Position / Internship Experience
                      </>
                    )}
                  </h3>
                  {editingExpId && <span className="editing-badge">Editing ID: {editingExpId}</span>}
                </div>

                <div className="form-grid-3">
                  <div className="form-group">
                    <label>Role / Position Title *</label>
                    <input
                      type="text"
                      placeholder="e.g. Artificial Intelligence Intern"
                      value={expForm.role}
                      onChange={(e) => setExpForm({ ...expForm, role: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Company / Organization *</label>
                    <input
                      type="text"
                      placeholder="e.g. Codec Technologies"
                      value={expForm.company}
                      onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Domain Category *</label>
                    <select
                      value={expForm.category || 'web'}
                      onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                    >
                      <option value="ai">AI &amp; Machine Learning Internships</option>
                      <option value="web">Web &amp; Full Stack Internships</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Period / Duration</label>
                    <input
                      type="text"
                      placeholder="e.g. Jun 2025 - Jul 2025"
                      value={expForm.period}
                      onChange={(e) => setExpForm({ ...expForm, period: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Location / Mode</label>
                    <input
                      type="text"
                      placeholder="e.g. Remote / Hybrid"
                      value={expForm.location}
                      onChange={(e) => setExpForm({ ...expForm, location: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Skills &amp; Technologies Used (comma-separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Python, Machine Learning, Neural Networks, Data Preprocessing"
                    value={expForm.skills || ''}
                    onChange={(e) => setExpForm({ ...expForm, skills: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Responsibilities &amp; Achievements (one bullet per line)</label>
                  <textarea
                    rows={4}
                    placeholder="Completed a 1-month internship in Artificial Intelligence with hands-on project development.&#10;Worked on real-world AI concepts including machine learning models and data preprocessing."
                    value={expForm.description}
                    onChange={(e) => setExpForm({ ...expForm, description: e.target.value })}
                  />
                </div>

                {/* Certificate Metadata & Upload / Path for Experience */}
                <div className="form-grid-3" style={{ marginTop: '0.25rem' }}>
                  <div className="form-group">
                    <label>Certificate Title (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. AI Virtual Internship Certificate"
                      value={expForm.certificateTitle || ''}
                      onChange={(e) => setExpForm({ ...expForm, certificateTitle: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Certificate Issuer (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Infosys Springboard"
                      value={expForm.certificateIssuer || ''}
                      onChange={(e) => setExpForm({ ...expForm, certificateIssuer: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Certificate Date (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Feb 2026"
                      value={expForm.certificateDate || ''}
                      onChange={(e) => setExpForm({ ...expForm, certificateDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <FileUploadZone
                    label="Internship Certificate Image or PDF (Optional)"
                    allowPdf={true}
                    value={expForm.certificateFile || ''}
                    onChange={(url) =>
                      setExpForm({
                        ...expForm,
                        certificateFile: url || '',
                      })
                    }
                    helpText="Upload or link the internship completion certificate (PDF or Image) shown on the Experience card"
                  />
                </div>

                <div className="form-submit-footer">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Saving to MongoDB...'
                      : editingExpId
                      ? 'Save Changes to MongoDB'
                      : 'Add Experience'}
                  </button>
                  {editingExpId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleCancelEditExp}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              <div className="items-simple-list">
                {filteredExp.map((exp) => {
                  const expItemId = exp.id || exp._id;
                  const isCurrentlyEditing = editingExpId && String(editingExpId) === String(expItemId);
                  const bullets =
                    Array.isArray(exp.description) && exp.description.length > 0
                      ? exp.description
                      : Array.isArray(exp.details)
                      ? exp.details
                      : [];
                  const techTags =
                    Array.isArray(exp.skills) && exp.skills.length > 0
                      ? exp.skills
                      : Array.isArray(exp.tech)
                      ? exp.tech
                      : [];
                  const expCat =
                    exp.category ||
                    ((exp.role || exp.title || '').toLowerCase().includes('ai') ? 'ai' : 'web');
                  const expCertDoc =
                    exp.certificate?.file || exp.certificate?.preview || exp.certificate?.image;

                  return (
                    <div
                      key={expItemId}
                      className={`simple-list-card ${isCurrentlyEditing ? 'editing-active-card' : ''}`}
                    >
                      <div className="simple-list-info">
                        <div className="admin-card-title-row">
                          <h4>{exp.role || exp.title}</h4>
                          <span className="admin-category-badge">
                            {expCat === 'ai' ? 'AI & Machine Learning' : 'Web & Full Stack'}
                          </span>
                          {isCurrentlyEditing && (
                            <span className="editing-badge">Editing Now</span>
                          )}
                          {expCertDoc && (
                            <button
                              type="button"
                              className="table-doc-pill"
                              onClick={() =>
                                setPreviewCertificate({
                                  title:
                                    exp.certificate?.title ||
                                    `${exp.role || exp.title} - ${exp.company}`,
                                  issuer: exp.certificate?.issuer || exp.company,
                                  date: exp.certificate?.date || exp.period || exp.duration,
                                  file: expCertDoc,
                                  preview: exp.certificate?.preview || expCertDoc,
                                  image: exp.certificate?.image || expCertDoc,
                                })
                              }
                              style={{ cursor: 'pointer', background: 'none' }}
                              title="Preview Internship Certificate"
                            >
                              <FileText size={12} style={{ color: '#38bdf8' }} />
                              <span>View Certificate</span>
                            </button>
                          )}
                        </div>
                        <div className="simple-list-sub">
                          <strong>{exp.company}</strong> · <span>{exp.period || exp.duration}</span> ·{' '}
                          <span>{exp.location || 'Remote'}</span>
                        </div>
                        {bullets.length > 0 && (
                          <ul className="exp-bullets">
                            {bullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {techTags.length > 0 && (
                          <div className="card-tech-chips" style={{ marginTop: '8px' }}>
                            {techTags.map((t, idx) => (
                              <span key={idx} className="tech-chip">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="simple-card-actions">
                        <button
                          type="button"
                          className="btn-edit-simple-card"
                          onClick={() => handleStartEditExp(exp)}
                          title="Edit Experience in MongoDB"
                        >
                          <Pencil size={14} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-delete-card"
                          onClick={() => handleDeleteExp(exp)}
                          title="Delete Experience"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: PHOTOS & PROFILE */}
          {activeTab === 'photos' && (
            <div className="admin-photos-view">
              <div className="view-header-bar">
                <div>
                  <h2>Photos &amp; Profile Configuration</h2>
                  <p>
                    Update live images, headshot, about SVG card, brand logo, headline, and resume link.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpdatePhotos} className="admin-card-form">
                <div className="photos-preview-gallery">
                  <div className="photo-preview-item">
                    <label>Current Hero Headshot</label>
                    <div className="photo-preview-frame">
                      <img
                        src={photoForm.heroImage || personalInfo.heroImage}
                        alt="Hero preview"
                      />
                    </div>
                  </div>

                  <div className="photo-preview-item">
                    <label>Current About SVG Intro Card</label>
                    <div className="photo-preview-frame">
                      <img
                        src={photoForm.aboutImage || personalInfo.aboutImage}
                        alt="About preview"
                      />
                    </div>
                  </div>

                  <div className="photo-preview-item">
                    <label>Current Brand Logo</label>
                    <div className="photo-preview-frame logo-frame">
                      <img
                        src={photoForm.logoImage || personalInfo.logoImage}
                        alt="Logo preview"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <FileUploadZone
                      label="Hero Headshot Image (JPG, PNG, WebP)"
                      accept="image/*"
                      value={photoForm.heroImage}
                      onChange={(url) => setPhotoForm({ ...photoForm, heroImage: url })}
                      helpText="Upload or paste URL for Hero section profile photo"
                    />
                  </div>

                  <div className="form-group">
                    <FileUploadZone
                      label="About Section Intro Card (SVG, PNG, JPG)"
                      accept="image/*"
                      value={photoForm.aboutImage}
                      onChange={(url) => setPhotoForm({ ...photoForm, aboutImage: url })}
                      helpText="Upload or paste URL for About section illustration/card"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <FileUploadZone
                      label="Brand Monogram / Logo Image"
                      accept="image/*"
                      value={photoForm.logoImage}
                      onChange={(url) => setPhotoForm({ ...photoForm, logoImage: url })}
                      helpText="Upload or paste URL for Navbar & Footer brand logo"
                    />
                  </div>

                  <div className="form-group">
                    <FileUploadZone
                      label="Official Resume Document (PDF or Image)"
                      allowPdf={true}
                      value={photoForm.resumeUrl}
                      onChange={(url) => setPhotoForm({ ...photoForm, resumeUrl: url })}
                      helpText="Upload Resume PDF or paste URL (opens in Portfolio View Resume modal)"
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Display Name</label>
                    <input
                      type="text"
                      value={photoForm.name}
                      onChange={(e) => setPhotoForm({ ...photoForm, name: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Professional Title</label>
                    <input
                      type="text"
                      value={photoForm.title}
                      onChange={(e) => setPhotoForm({ ...photoForm, title: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Hero Bio / Lead Subtitle</label>
                  <textarea
                    rows={3}
                    value={photoForm.bioLead}
                    onChange={(e) => setPhotoForm({ ...photoForm, bioLead: e.target.value })}
                  />
                </div>

                <div className="form-submit-footer">
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? 'Updating...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 8: CONTACT INBOX (MongoDB) */}
          {activeTab === 'messages' && (
            <div className="admin-messages-view">
              <div className="view-header-bar">
                <div>
                  <h2>Contact Inquiries Inbox (MongoDB Database)</h2>
                  <p>
                    Inquiries received from portfolio visitors and stored in MongoDB `messages` collection.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fetchContactMessages}
                  disabled={isLoadingMessages}
                >
                  <RefreshCw size={14} className={isLoadingMessages ? 'spin' : ''} />
                  <span>Refresh Inbox</span>
                </button>
              </div>

              {contactMessages.length > 0 ? (
                <div className="messages-grid">
                  {contactMessages.map((msg) => (
                    <div key={msg.id || msg._id} className={`message-card ${msg.status}`}>
                      <div className="message-card-header">
                        <div>
                          <span className="msg-sender-name">{msg.name}</span>
                          <a href={`mailto:${msg.email}`} className="msg-sender-email">
                            {msg.email}
                          </a>
                        </div>
                        <div className="msg-meta-actions">
                          <span className="msg-time">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            className="btn-delete-card"
                            onClick={() => handleDeleteMessage(msg.id || msg._id)}
                            title="Delete inquiry from MongoDB"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="msg-subject-box">
                        <strong>Subject:</strong> {msg.subject || 'Portfolio Contact Inquiry'}
                        {msg.inquiryType && (
                          <span
                            style={{
                              marginLeft: '0.6rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              background: 'rgba(56, 189, 248, 0.14)',
                              color: '#38bdf8',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                            }}
                          >
                            {msg.inquiryType}
                          </span>
                        )}
                      </div>

                      <p className="msg-body-content">{msg.message}</p>

                      <div className="msg-reply-row" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <a
                          href={`mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent(
                            msg.subject ? `Re: ${msg.subject}` : 'Re: Portfolio Contact Inquiry'
                          )}&body=${encodeURIComponent(
                            `Hi ${msg.name || 'there'},\n\nThank you for reaching out through my portfolio website.\n\n\n---\nOn ${new Date(
                              msg.timestamp || msg.createdAt || Date.now()
                            ).toLocaleString()}, ${msg.name} wrote:\n"${msg.message}"\n\nBest regards,\nSachin Kumar\nSoftware Engineer & AI/ML Developer`
                          )}`}
                          className="btn-reply-email"
                          title={`Reply directly to ${msg.name} (${msg.email})`}
                          onClick={() => handleMarkMessageRead(msg.id || msg._id)}
                        >
                          <Reply size={15} />
                          <span>Reply via Email</span>
                        </a>
                        {msg.status === 'unread' && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '0.38rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => handleMarkMessageRead(msg.id || msg._id)}
                          >
                            <Check size={14} />
                            <span>Mark as Read</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-inbox-state">
                  <Inbox size={42} />
                  <h3>No Inquiries Yet</h3>
                  <p>
                    When visitors use the Get In Touch form on your portfolio, their messages will appear here in MongoDB.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 9: MONGODB & API MONITOR */}
          {activeTab === 'mongodb' && (
            <MongoInspectorTab
              backendHealth={backendHealth}
              apiStats={apiStats}
              projectsCount={projectsList.length}
              certificationsCount={certificationsList.length}
              educationCount={educationList.length}
              experienceCount={experienceList.length}
              skillsCount={totalSkillsCount}
              messagesCount={contactMessages.length}
              onRefreshHealth={() => {
                fetchBackendData();
                fetchContactMessages();
                if (refreshPortfolioData) refreshPortfolioData();
              }}
            />
          )}

          {/* TAB 10: AUDIT TRAIL & ACTIVITY LOGS */}
          {activeTab === 'audit-logs' && (
            <AdminAuditLogs
              auditLogs={auditLogs}
              auditStats={auditStats}
              isLoading={isLoadingAuditLogs}
              onRefresh={() => {
                fetchAuditLogs();
                fetchAuditStats();
                showToast('Audit logs refreshed!');
              }}
              onDeleteLog={async (logId) => {
                if (!requireAdminAuth('delete audit log entry')) return;
                try {
                  await deleteAuditLog(logId);
                  showToast('Audit log entry removed.');
                } catch (err) {
                  showToast('Failed to delete log: ' + err.message, true);
                }
              }}
              onClearLogs={async (col) => {
                if (!requireAdminAuth('clear audit logs')) return;
                try {
                  await clearAuditLogs(col);
                  showToast('Audit logs cleared!');
                } catch (err) {
                  showToast('Failed to clear logs: ' + err.message, true);
                }
              }}
            />
          )}
        </main>
      </div>

      {/* Mobile Navigation: Quick Bottom Bar & Full Drawer Menu */}
      <AdminMobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        counts={counts}
        onNavigateToFrontend={onNavigateToFrontend}
        handleSeedAll={handleSeedAll}
        isSubmitting={isSubmitting}
        isDrawerOpen={isMobileMenuOpen}
        setIsDrawerOpen={setIsMobileMenuOpen}
        isAdmin={isAdmin}
        dbUser={dbUser}
        setDevAdminBypass={setDevAdminBypass}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        logoutAdmin={logoutAdmin}
        showToast={showToast}
      />

      {/* Admin Authentication Modal (Opened automatically if user tries to Add/Edit/Delete without Login) */}
      <AdminAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        showToast={showToast}
        initialMode="login"
      />

      {/* In-Admin Certificate / PDF Preview Modal */}
      {previewCertificate && (
        <CertificateModal
          certificate={previewCertificate}
          onClose={() => setPreviewCertificate(null)}
        />
      )}
    </div>
  );
};

export const AdminApp = AdminControlPanel;
export default AdminControlPanel;
