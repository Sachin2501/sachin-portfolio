import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  FolderGit2,
  Award,
  GraduationCap,
  Cpu,
  Briefcase,
  Image,
  Database,
  Lock,
  LogOut,
  CheckCircle2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const AdminCMSModal = ({ isOpen, onClose }) => {
  const {
    currentUser,
    isAdmin,
    devAdminBypass,
    setDevAdminBypass,
    isSigningIn,
    loginWithGoogle,
    logoutAdmin,
    isBackendConnected,
    projectsList,
    certificationsList,
    educationList,
    experienceList,
    customSkills,
    profileConfig,
    addProject,
    deleteProject,
    addCertification,
    deleteCertification,
    addEducation,
    deleteEducation,
    addExperience,
    deleteExperience,
    addSkill,
    deleteSkill,
    updateProfilePhotos,
    seedInitialData,
  } = usePortfolioBackend();

  const [activeTab, setActiveTab] = useState('projects');
  const [statusMessage, setStatusMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [projectForm, setProjectForm] = useState({
    title: '',
    category: 'Full Stack',
    description: '',
    tech: 'React, Node.js, Tailwind CSS',
    githubUrl: '',
    liveUrl: '',
    image: '/images/photo7.jpeg',
  });

  const [certForm, setCertForm] = useState({
    title: '',
    issuer: '',
    date: '2026',
    category: 'web',
    image: '/certificates/cert1.pdf',
    credentialUrl: '',
  });

  const [eduForm, setEduForm] = useState({
    degree: '',
    institute: '',
    duration: '2022 - 2026',
    grade: '8.5 CGPA',
    status: 'Pursuing',
    category: 'engineering',
    highlights: 'Algorithms & Data Structures, Distributed Systems',
    skills: 'Java, Python, C++',
  });

  const [skillForm, setSkillForm] = useState({
    domainId: 'frontend',
    name: '',
    level: 'Advanced',
    icon: 'fab fa-react',
    highlight: false,
  });

  const [expForm, setExpForm] = useState({
    role: '',
    company: '',
    duration: 'Jun 2026 - Present',
    category: 'web',
    details: 'Engineered scalable full-stack features and API endpoints.',
    tech: 'React, TypeScript, Express, PostgreSQL',
  });

  const [photoForm, setPhotoForm] = useState({
    heroImage: profileConfig.heroImage || '',
    aboutImage: profileConfig.aboutImage || '',
    logoImage: profileConfig.logoImage || '',
    resumeUrl: profileConfig.resumeUrl || '',
  });

  const showToast = (msg, isError = false) => {
    setStatusMessage({ text: msg, isError });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  if (!isOpen) return null;

  // Handlers
  const handleAddProject = async (e) => {
    e.preventDefault();
    if (!projectForm.title.trim()) return;
    setIsSubmitting(true);
    try {
      await addProject({
        title: projectForm.title.trim(),
        category: projectForm.category,
        description: projectForm.description.trim(),
        tech: projectForm.tech.split(',').map((t) => t.trim()).filter(Boolean),
        githubUrl: projectForm.githubUrl.trim(),
        liveUrl: projectForm.liveUrl.trim(),
        image: projectForm.image.trim() || '/assets/aistudio/projects-bg_f9111c06.png',
      });
      setProjectForm({
        title: '',
        category: 'Full Stack',
        description: '',
        tech: 'React, Node.js, Tailwind CSS',
        githubUrl: '',
        liveUrl: '',
        image: '/assets/aistudio/projects-bg_f9111c06.png',
      });
      showToast('Project added to backend successfully!');
    } catch (err) {
      showToast('Error adding project: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCert = async (e) => {
    e.preventDefault();
    if (!certForm.title.trim() || !certForm.issuer.trim()) return;
    setIsSubmitting(true);
    try {
      await addCertification({
        title: certForm.title.trim(),
        issuer: certForm.issuer.trim(),
        date: certForm.date.trim(),
        category: certForm.category,
        certificate: {
          title: certForm.title.trim(),
          issuer: certForm.issuer.trim(),
          date: certForm.date.trim(),
          image: certForm.image.trim(),
          credentialUrl: certForm.credentialUrl.trim(),
        },
      });
      setCertForm({
        title: '',
        issuer: '',
        date: '2026',
        category: 'web',
        image: '/certificates/cert1.pdf',
        credentialUrl: '',
      });
      showToast('Certification added to backend successfully!');
    } catch (err) {
      showToast('Error adding certification: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddEdu = async (e) => {
    e.preventDefault();
    if (!eduForm.degree.trim() || !eduForm.institute.trim()) return;
    setIsSubmitting(true);
    try {
      await addEducation({
        degree: eduForm.degree.trim(),
        institute: eduForm.institute.trim(),
        duration: eduForm.duration.trim(),
        grade: eduForm.grade.trim(),
        status: eduForm.status.trim(),
        category: eduForm.category,
        highlights: eduForm.highlights.split(',').map((h) => h.trim()).filter(Boolean),
        skills: eduForm.skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setEduForm({
        degree: '',
        institute: '',
        duration: '2022 - 2026',
        grade: '8.5 CGPA',
        status: 'Pursuing',
        category: 'engineering',
        highlights: 'Algorithms & Data Structures, Distributed Systems',
        skills: 'Java, Python, C++',
      });
      showToast('Education added to backend successfully!');
    } catch (err) {
      showToast('Error adding education: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddExp = async (e) => {
    e.preventDefault();
    if (!expForm.role.trim() || !expForm.company.trim()) return;
    setIsSubmitting(true);
    try {
      await addExperience({
        role: expForm.role.trim(),
        company: expForm.company.trim(),
        duration: expForm.duration.trim(),
        category: expForm.category,
        details: expForm.details.split('\n').map((d) => d.trim()).filter(Boolean),
        tech: expForm.tech.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setExpForm({
        role: '',
        company: '',
        duration: 'Jun 2026 - Present',
        category: 'web',
        details: 'Engineered scalable full-stack features and API endpoints.',
        tech: 'React, TypeScript, Express, PostgreSQL',
      });
      showToast('Experience added to backend successfully!');
    } catch (err) {
      showToast('Error adding experience: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!skillForm.name.trim()) return;
    setIsSubmitting(true);
    try {
      await addSkill({
        domainId: skillForm.domainId,
        name: skillForm.name.trim(),
        level: skillForm.level,
        icon: skillForm.icon.trim() || 'fas fa-code',
        highlight: skillForm.highlight,
      });
      setSkillForm({
        domainId: 'frontend',
        name: '',
        level: 'Advanced',
        icon: 'fab fa-react',
        highlight: false,
      });
      showToast('Skill added to backend successfully!');
    } catch (err) {
      showToast('Error adding skill: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePhotos = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateProfilePhotos({
        heroImage: photoForm.heroImage.trim() || profileConfig.heroImage,
        aboutImage: photoForm.aboutImage.trim() || profileConfig.aboutImage,
        logoImage: photoForm.logoImage.trim() || profileConfig.logoImage,
        resumeUrl: photoForm.resumeUrl.trim() || profileConfig.resumeUrl,
      });
      showToast('Photos & Profile updated successfully in Cloud!');
    } catch (err) {
      showToast('Error updating photos: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeedAll = async () => {
    if (!window.confirm('Sync all default portfolio items (projects, certs, education, experience) into Firestore?')) return;
    setIsSubmitting(true);
    try {
      await seedInitialData();
      showToast('All initial data synchronized to Firestore cloud!');
    } catch (err) {
      showToast('Sync error: ' + err.message, true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="admin-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-header-title">
            <span className="admin-header-badge">
              <Database size={18} />
            </span>
            <div>
              <h2>Portfolio Backend Studio</h2>
              <p className="admin-header-sub">
                Live Cloud Management: Add, edit, photo swap & delete content
              </p>
            </div>
          </div>
          <button type="button" className="admin-close-btn" onClick={onClose} aria-label="Close Admin CMS">
            <X size={20} />
          </button>
        </div>

        {/* Auth / Status Bar */}
        <div className="admin-auth-bar">
          <div className="admin-auth-info">
            <span className={`status-pill ${isBackendConnected ? 'connected' : 'connecting'}`}>
              <span className="pulse-indicator" />
              {isBackendConnected ? 'Firestore Connected' : 'Connecting to Cloud...'}
            </span>

            {isAdmin ? (
              <span className="admin-badge-verified">
                <CheckCircle2 size={15} />
                Admin Active {currentUser?.email ? `(${currentUser.email})` : '(Master Mode)'}
              </span>
            ) : (
              <span className="admin-badge-guest">
                <Lock size={14} /> Visitor Mode (View Only)
              </span>
            )}
          </div>

          <div className="admin-auth-actions">
            {!isAdmin ? (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-google-auth"
                  disabled={isSigningIn}
                  onClick={async () => {
                    const res = await loginWithGoogle();
                    if (res?.success) {
                      showToast('Signed in successfully as ' + (res.user?.email || 'admin') + '!');
                    } else if (res?.cancelled) {
                      showToast('Popup closed or cancelled. Tip: Click "Master Access" for instant admin mode.', false);
                    } else if (res?.error) {
                      showToast('Google auth note: ' + res.error + '. Try Master Access.', true);
                    }
                  }}
                  title="Sign in with your Google Account or use Master Access"
                >
                  <i className={isSigningIn ? 'fas fa-spinner fa-spin' : 'fab fa-google'}></i>{' '}
                  {isSigningIn ? 'Connecting...' : 'Sign In with Google'}
                </button>
                <button
                  type="button"
                  className="btn-dev-admin"
                  onClick={() => {
                    setDevAdminBypass(true);
                    showToast('Admin mode enabled!');
                  }}
                  title="Enable direct admin management"
                >
                  Master Access
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-seed-data"
                  onClick={handleSeedAll}
                  disabled={isSubmitting}
                  title="Push all default portfolio records to Firestore"
                >
                  <Sparkles size={14} /> Sync to Cloud
                </button>
                <button
                  type="button"
                  className="btn-logout"
                  onClick={logoutAdmin}
                  title="Sign out"
                >
                  <LogOut size={14} /> Exit Admin
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toast Alert */}
        {statusMessage && (
          <div className={`admin-toast ${statusMessage.isError ? 'error' : 'success'}`}>
            {statusMessage.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="admin-tabs-rail">
          {[
            { id: 'projects', label: `Projects (${projectsList.length})`, icon: FolderGit2 },
            { id: 'certifications', label: `Certifications (${certificationsList.length})`, icon: Award },
            { id: 'education', label: `Education (${educationList.length})`, icon: GraduationCap },
            { id: 'skills', label: `Skills (${customSkills.length} added)`, icon: Cpu },
            { id: 'experience', label: `Experience (${experienceList.length})`, icon: Briefcase },
            { id: 'photos', label: 'Photos & Profile', icon: Image },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`admin-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="admin-modal-body">
          {/* ================================================= */}
          {/* 1. PROJECTS TAB */}
          {/* ================================================= */}
          {activeTab === 'projects' && (
            <div className="admin-tab-section">
              <div className="admin-form-card">
                <h3><Plus size={18} /> Add New Project</h3>
                <form onSubmit={handleAddProject} className="admin-grid-form">
                  <div className="form-group full-width">
                    <label>Project Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AI Autonomous Drone Navigator"
                      value={projectForm.title}
                      onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={projectForm.category}
                      onChange={(e) => setProjectForm({ ...projectForm, category: e.target.value })}
                    >
                      <option value="Full Stack">Full Stack</option>
                      <option value="Machine Learning">Machine Learning</option>
                      <option value="AI / Computer Vision">AI / Computer Vision</option>
                      <option value="Frontend">Frontend</option>
                      <option value="Cloud / Backend">Cloud / Backend</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Tech Stack (comma separated)</label>
                    <input
                      type="text"
                      placeholder="React, TypeScript, Python, TensorFlow"
                      value={projectForm.tech}
                      onChange={(e) => setProjectForm({ ...projectForm, tech: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Project Description *</label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Summary of what the project solves and key technical achievements..."
                      value={projectForm.description}
                      onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>GitHub Repository URL</label>
                    <input
                      type="url"
                      placeholder="https://github.com/Sachin2501/my-repo"
                      value={projectForm.githubUrl}
                      onChange={(e) => setProjectForm({ ...projectForm, githubUrl: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Live Demo URL (optional)</label>
                    <input
                      type="url"
                      placeholder="https://my-project.vercel.app"
                      value={projectForm.liveUrl}
                      onChange={(e) => setProjectForm({ ...projectForm, liveUrl: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Cover Image URL</label>
                    <input
                      type="text"
                      placeholder="/assets/aistudio/projects-bg_f9111c06.png or URL"
                      value={projectForm.image}
                      onChange={(e) => setProjectForm({ ...projectForm, image: e.target.value })}
                    />
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-admin-submit" disabled={isSubmitting || !isAdmin}>
                      <Plus size={16} /> Add Project to Portfolio
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Projects List */}
              <div className="admin-items-list-card">
                <h3>Current Projects ({projectsList.length})</h3>
                <div className="admin-items-grid">
                  {projectsList.map((p) => (
                    <div key={p.id} className="admin-item-row">
                      <div className="item-main-info">
                        <strong>{p.title}</strong>
                        <span className="item-sub-tag">{p.category || 'Project'}</span>
                        <p className="item-snippet">{p.description?.slice(0, 85)}...</p>
                      </div>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => {
                          if (window.confirm(`Delete project "${p.title}"?`)) {
                            deleteProject(p.id);
                            showToast(`Deleted ${p.title}`);
                          }
                        }}
                        disabled={!isAdmin}
                        title="Delete project"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* 2. CERTIFICATIONS TAB */}
          {/* ================================================= */}
          {activeTab === 'certifications' && (
            <div className="admin-tab-section">
              <div className="admin-form-card">
                <h3><Plus size={18} /> Add New Certification</h3>
                <form onSubmit={handleAddCert} className="admin-grid-form">
                  <div className="form-group">
                    <label>Certificate Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. AWS Certified Cloud Practitioner"
                      value={certForm.title}
                      onChange={(e) => setCertForm({ ...certForm, title: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Issuing Organization *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amazon Web Services / ISRO / Google"
                      value={certForm.issuer}
                      onChange={(e) => setCertForm({ ...certForm, issuer: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={certForm.category}
                      onChange={(e) => setCertForm({ ...certForm, category: e.target.value })}
                    >
                      <option value="web">Web Development</option>
                      <option value="ai">Artificial Intelligence / ML</option>
                      <option value="isro">ISRO Certifications</option>
                      <option value="internship">Internship Certifications</option>
                      <option value="other">Other Course Certifications</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Date or Year</label>
                    <input
                      type="text"
                      placeholder="e.g. Nov 2026"
                      value={certForm.date}
                      onChange={(e) => setCertForm({ ...certForm, date: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Certificate Document / PDF URL</label>
                    <input
                      type="text"
                      placeholder="/certificates/cert1.pdf or preview image URL"
                      value={certForm.image}
                      onChange={(e) => setCertForm({ ...certForm, image: e.target.value })}
                    />
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-admin-submit" disabled={isSubmitting || !isAdmin}>
                      <Plus size={16} /> Add Certification
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Certifications */}
              <div className="admin-items-list-card">
                <h3>Current Certifications ({certificationsList.length})</h3>
                <div className="admin-items-grid">
                  {certificationsList.map((c) => (
                    <div key={c.id} className="admin-item-row">
                      <div className="item-main-info">
                        <strong>{c.title}</strong>
                        <span className="item-sub-tag">{c.issuer} • {c.date}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => {
                          if (window.confirm(`Delete certificate "${c.title}"?`)) {
                            deleteCertification(c.id);
                            showToast(`Deleted ${c.title}`);
                          }
                        }}
                        disabled={!isAdmin}
                        title="Delete certification"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* 3. EDUCATION TAB */}
          {/* ================================================= */}
          {activeTab === 'education' && (
            <div className="admin-tab-section">
              <div className="admin-form-card">
                <h3><Plus size={18} /> Add New Education Record</h3>
                <form onSubmit={handleAddEdu} className="admin-grid-form">
                  <div className="form-group">
                    <label>Degree / Qualification *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Master of Science in AI"
                      value={eduForm.degree}
                      onChange={(e) => setEduForm({ ...eduForm, degree: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Institute / University *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Indian Institute of Technology"
                      value={eduForm.institute}
                      onChange={(e) => setEduForm({ ...eduForm, institute: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Duration / Period</label>
                    <input
                      type="text"
                      placeholder="2022 - 2026"
                      value={eduForm.duration}
                      onChange={(e) => setEduForm({ ...eduForm, duration: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Grade / Score</label>
                    <input
                      type="text"
                      placeholder="8.8 CGPA / First Class with Distinction"
                      value={eduForm.grade}
                      onChange={(e) => setEduForm({ ...eduForm, grade: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Status</label>
                    <input
                      type="text"
                      placeholder="Completed / Pursuing"
                      value={eduForm.status}
                      onChange={(e) => setEduForm({ ...eduForm, status: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={eduForm.category}
                      onChange={(e) => setEduForm({ ...eduForm, category: e.target.value })}
                    >
                      <option value="engineering">Engineering & Technology</option>
                      <option value="sciences">Mathematical Sciences</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Highlights (comma separated)</label>
                    <input
                      type="text"
                      placeholder="Specialization in Machine Learning, Dean's List, Research Project"
                      value={eduForm.highlights}
                      onChange={(e) => setEduForm({ ...eduForm, highlights: e.target.value })}
                    />
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-admin-submit" disabled={isSubmitting || !isAdmin}>
                      <Plus size={16} /> Add Education Record
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Education */}
              <div className="admin-items-list-card">
                <h3>Current Education Records ({educationList.length})</h3>
                <div className="admin-items-grid">
                  {educationList.map((e) => (
                    <div key={e.id} className="admin-item-row">
                      <div className="item-main-info">
                        <strong>{e.degree}</strong>
                        <span className="item-sub-tag">{e.institute} ({e.duration})</span>
                        <p className="item-snippet">{e.grade}</p>
                      </div>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => {
                          if (window.confirm(`Delete education "${e.degree}"?`)) {
                            deleteEducation(e.id);
                            showToast(`Deleted ${e.degree}`);
                          }
                        }}
                        disabled={!isAdmin}
                        title="Delete education"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* 4. SKILLS TAB */}
          {/* ================================================= */}
          {activeTab === 'skills' && (
            <div className="admin-tab-section">
              <div className="admin-form-card">
                <h3><Plus size={18} /> Add New Technical Skill</h3>
                <form onSubmit={handleAddSkill} className="admin-grid-form">
                  <div className="form-group">
                    <label>Skill Domain Category *</label>
                    <select
                      value={skillForm.domainId}
                      onChange={(e) => setSkillForm({ ...skillForm, domainId: e.target.value })}
                    >
                      <option value="frontend">Frontend Development</option>
                      <option value="backend">Backend & Cloud</option>
                      <option value="ai-ml">AI & Machine Learning</option>
                      <option value="programming-languages">Languages & Core</option>
                      <option value="tools-devops">DevOps & Tools</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Skill Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Next.js / GraphQL / PyTorch"
                      value={skillForm.name}
                      onChange={(e) => setSkillForm({ ...skillForm, name: e.target.value })}
                    />
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

                  <div className="form-group">
                    <label>FontAwesome / Icon Class</label>
                    <input
                      type="text"
                      placeholder="fab fa-react or fas fa-code"
                      value={skillForm.icon}
                      onChange={(e) => setSkillForm({ ...skillForm, icon: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.8rem' }}>
                    <input
                      type="checkbox"
                      id="skillHighlight"
                      checked={skillForm.highlight}
                      onChange={(e) => setSkillForm({ ...skillForm, highlight: e.target.checked })}
                      style={{ width: 'auto' }}
                    />
                    <label htmlFor="skillHighlight" style={{ margin: 0, cursor: 'pointer' }}>
                      Mark as Core / Featured Skill (star highlight)
                    </label>
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-admin-submit" disabled={isSubmitting || !isAdmin}>
                      <Plus size={16} /> Add Skill to Domain
                    </button>
                  </div>
                </form>
              </div>

              {/* Added Custom Skills */}
              <div className="admin-items-list-card">
                <h3>Added Skills in Cloud ({customSkills.length})</h3>
                {customSkills.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', padding: '1rem' }}>
                    No custom skills added yet. Add skills above to dynamically inject them into any domain.
                  </p>
                ) : (
                  <div className="admin-items-grid">
                    {customSkills.map((s) => (
                      <div key={s.id} className="admin-item-row">
                        <div className="item-main-info">
                          <strong>{s.name}</strong>
                          <span className="item-sub-tag">{s.domainId} • {s.level}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-delete-item"
                          onClick={() => {
                            deleteSkill(s.id);
                            showToast(`Deleted skill ${s.name}`);
                          }}
                          disabled={!isAdmin}
                          title="Delete skill"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* 5. EXPERIENCE TAB */}
          {/* ================================================= */}
          {activeTab === 'experience' && (
            <div className="admin-tab-section">
              <div className="admin-form-card">
                <h3><Plus size={18} /> Add New Experience / Internship</h3>
                <form onSubmit={handleAddExp} className="admin-grid-form">
                  <div className="form-group">
                    <label>Role / Position *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Software Engineer Intern"
                      value={expForm.role}
                      onChange={(e) => setExpForm({ ...expForm, role: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Company / Organization *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Google / Microsoft / Startup"
                      value={expForm.company}
                      onChange={(e) => setExpForm({ ...expForm, company: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Duration</label>
                    <input
                      type="text"
                      placeholder="Jan 2026 - Present"
                      value={expForm.duration}
                      onChange={(e) => setExpForm({ ...expForm, duration: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select
                      value={expForm.category}
                      onChange={(e) => setExpForm({ ...expForm, category: e.target.value })}
                    >
                      <option value="ai">AI & Machine Learning</option>
                      <option value="web">Web & Full Stack</option>
                    </select>
                  </div>

                  <div className="form-group full-width">
                    <label>Key Responsibilities / Achievements (1 per line)</label>
                    <textarea
                      rows={3}
                      placeholder="Developed RESTful microservices for high throughput.&#10;Reduced latency by 35% through Redis caching."
                      value={expForm.details}
                      onChange={(e) => setExpForm({ ...expForm, details: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Tech Used (comma separated)</label>
                    <input
                      type="text"
                      placeholder="React, Node.js, Docker, Kubernetes"
                      value={expForm.tech}
                      onChange={(e) => setExpForm({ ...expForm, tech: e.target.value })}
                    />
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-admin-submit" disabled={isSubmitting || !isAdmin}>
                      <Plus size={16} /> Add Experience
                    </button>
                  </div>
                </form>
              </div>

              {/* Existing Experience List */}
              <div className="admin-items-list-card">
                <h3>Current Experience Records ({experienceList.length})</h3>
                <div className="admin-items-grid">
                  {experienceList.map((exp) => (
                    <div key={exp.id} className="admin-item-row">
                      <div className="item-main-info">
                        <strong>{exp.role}</strong>
                        <span className="item-sub-tag">{exp.company} • {exp.duration}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-delete-item"
                        onClick={() => {
                          if (window.confirm(`Delete experience "${exp.role} at ${exp.company}"?`)) {
                            deleteExperience(exp.id);
                            showToast(`Deleted ${exp.role}`);
                          }
                        }}
                        disabled={!isAdmin}
                        title="Delete experience"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================================================= */}
          {/* 6. PHOTOS & PROFILE TAB */}
          {/* ================================================= */}
          {activeTab === 'photos' && (
            <div className="admin-tab-section">
              <div className="admin-form-card">
                <h3><Image size={18} /> Update Photos & Identity Assets</h3>
                <form onSubmit={handleUpdatePhotos} className="admin-grid-form">
                  <div className="form-group full-width">
                    <label>Home Section Hero Photo URL / Path</label>
                    <input
                      type="text"
                      placeholder="/assets/aistudio/Polished_Corporate_Headshot_on_Gray_77b053e0.png"
                      value={photoForm.heroImage}
                      onChange={(e) => setPhotoForm({ ...photoForm, heroImage: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Renders in the circular floating portrait in the Home Hero section.
                    </small>
                  </div>

                  <div className="form-group full-width">
                    <label>About Section Card / Graphic URL</label>
                    <input
                      type="text"
                      placeholder="/assets/aistudio/dev-intro-card_360f1a33.svg"
                      value={photoForm.aboutImage}
                      onChange={(e) => setPhotoForm({ ...photoForm, aboutImage: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Renders in the About section (supports SVG cards, illustrations, or photos).
                    </small>
                  </div>

                  <div className="form-group full-width">
                    <label>Logo Emblem Image URL</label>
                    <input
                      type="text"
                      placeholder="/assets/aistudio/Gemini_Generated_Image_hizeznhizeznhize_739e79f3.png"
                      value={photoForm.logoImage}
                      onChange={(e) => setPhotoForm({ ...photoForm, logoImage: e.target.value })}
                    />
                    <small style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Renders in the Navbar brand badge, mobile drawer, and footer monogram.
                    </small>
                  </div>

                  <div className="form-group full-width">
                    <label>Resume PDF Document URL</label>
                    <input
                      type="text"
                      placeholder="/certificates/resume.pdf"
                      value={photoForm.resumeUrl}
                      onChange={(e) => setPhotoForm({ ...photoForm, resumeUrl: e.target.value })}
                    />
                  </div>

                  {/* Visual Previews */}
                  <div className="admin-photo-previews">
                    <div className="preview-tile">
                      <span>Hero Portrait Preview</span>
                      <img
                        src={photoForm.heroImage || profileConfig.heroImage}
                        alt="Hero Preview"
                        style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </div>
                    <div className="preview-tile">
                      <span>About Graphic Preview</span>
                      <img
                        src={photoForm.aboutImage || profileConfig.aboutImage}
                        alt="About Preview"
                        style={{ width: '130px', height: '75px', borderRadius: '8px', objectFit: 'contain', background: '#0a0d18' }}
                      />
                    </div>
                    <div className="preview-tile">
                      <span>Logo Badge Preview</span>
                      <img
                        src={photoForm.logoImage || profileConfig.logoImage}
                        alt="Logo Preview"
                        style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>

                  <div className="form-action-row">
                    <button type="submit" className="btn-admin-submit" disabled={isSubmitting || !isAdmin}>
                      Save & Update Profile Photos in Cloud
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminCMSModal;
