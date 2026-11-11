import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Sparkles,
  Share2,
  Copy,
  Check,
  Globe,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Monitor,
  Code,
  FileText,
  Sliders,
  ExternalLink,
  ChevronRight,
  Layers,
} from 'lucide-react';

export const ProjectSeoGeneratorTab = ({
  projectsList,
  onUpdateProjectSEO,
  profileConfig,
}) => {
  // Currently selected project
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    return projectsList && projectsList.length > 0 ? projectsList[0].id : '';
  });

  const selectedProject = useMemo(() => {
    if (!projectsList || projectsList.length === 0) return null;
    return (
      projectsList.find((p) => p.id === selectedProjectId) || projectsList[0]
    );
  }, [projectsList, selectedProjectId]);

  // Social Preview Tab: 'google' | 'linkedin' | 'twitter' | 'discord'
  const [previewPlatform, setPreviewPlatform] = useState('google');
  // Google preview device toggle: 'desktop' | 'mobile'
  const [googleDevice, setGoogleDevice] = useState('desktop');
  // Twitter preview theme: 'dark' | 'light'
  const [twitterTheme, setTwitterTheme] = useState('dark');

  // Copy status indicators
  const [copiedType, setCopiedType] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Active form state for the selected project's SEO
  const [seoForm, setSeoForm] = useState({
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    canonicalUrl: '',
    ogImage: '',
    twitterCard: 'summary_large_image',
    robots: 'index, follow',
    schemaType: 'WebApplication',
    author: 'Sachin Kumar',
  });

  // Base domain for previews
  const siteDomain = typeof window !== 'undefined' ? window.location.host : 'sachinkumar.dev';
  const siteProtocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const baseUrl = `${siteProtocol}//${siteDomain}`;

  // Helper to generate SEO from project data
  const generateProjectSEO = useCallback(
    (project, tone = 'balanced') => {
      if (!project) return null;

      const techList = Array.isArray(project.technologies)
        ? project.technologies.join(', ')
        : (project.technologies || 'React, Node.js, AI');

      const primaryTech = Array.isArray(project.technologies) && project.technologies.length > 0
        ? project.technologies.slice(0, 3).join(', ')
        : 'Full Stack';

      const authorName = profileConfig?.name || 'Sachin Kumar';
      const cleanTitle = project.title || 'Portfolio Project';

      // Title (Ideal length: 45-58 characters)
      let metaTitle = `${cleanTitle} – ${primaryTech} Project | ${authorName}`;
      if (metaTitle.length > 60) {
        metaTitle = `${cleanTitle} | ${authorName} Portfolio`;
      }
      if (metaTitle.length > 60) {
        metaTitle = cleanTitle.slice(0, 57) + '...';
      }

      // Meta Description (Ideal length: 135-155 characters)
      let metaDescription = '';
      if (tone === 'recruiter') {
        metaDescription = `Explore ${cleanTitle}, built with ${techList}. Engineered by ${authorName} featuring high performance, clean architecture, and modern UX design.`;
      } else if (tone === 'technical') {
        metaDescription = `${cleanTitle}: A production-grade ${project.category || 'full stack'} application leveraging ${techList}. View live demo, architecture, and source code.`;
      } else {
        // Balanced
        const descPrefix = project.description
          ? project.description.replace(/\s+/g, ' ').trim()
          : `High-impact software engineering project leveraging ${techList}`;
        
        const candidate = `${cleanTitle}: ${descPrefix}. Built by ${authorName} using ${primaryTech}.`;
        if (candidate.length <= 158) {
          metaDescription = candidate;
        } else {
          metaDescription = candidate.slice(0, 155).trim() + '...';
        }
      }

      // Ensure length stays in sweet spot 120 - 158 chars
      if (metaDescription.length < 115) {
        metaDescription += ` Check out the live demo, source code, and developer insights.`;
      }
      if (metaDescription.length > 158) {
        metaDescription = metaDescription.slice(0, 155).trim() + '...';
      }

      // Slug
      const slug = cleanTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const keywords = `${cleanTitle}, ${project.category || 'Web Development'}, ${techList}, ${authorName}, Software Engineer Portfolio, Full Stack Developer, Open Source`;

      const ogImage =
        project.image ||
        '/assets/aistudio/projects-bg_f9111c06.png';

      const canonicalUrl = `${baseUrl}/#projects`;

      return {
        metaTitle,
        metaDescription,
        keywords,
        canonicalUrl,
        ogImage,
        twitterCard: 'summary_large_image',
        robots: 'index, follow',
        schemaType: project.category === 'AI / Machine Learning' ? 'SoftwareApplication' : 'WebApplication',
        author: authorName,
      };
    },
    [baseUrl, profileConfig]
  );

  // Sync form when selected project changes
  useEffect(() => {
    if (selectedProject) {
      if (selectedProject.seo && selectedProject.seo.metaTitle) {
        setSeoForm({
          metaTitle: selectedProject.seo.metaTitle || '',
          metaDescription: selectedProject.seo.metaDescription || '',
          keywords: selectedProject.seo.keywords || '',
          canonicalUrl: selectedProject.seo.canonicalUrl || `${baseUrl}/#projects`,
          ogImage: selectedProject.seo.ogImage || selectedProject.image || '',
          twitterCard: selectedProject.seo.twitterCard || 'summary_large_image',
          robots: selectedProject.seo.robots || 'index, follow',
          schemaType: selectedProject.seo.schemaType || 'WebApplication',
          author: selectedProject.seo.author || profileConfig?.name || 'Sachin Kumar',
        });
      } else {
        // Auto-populate intelligent defaults
        const auto = generateProjectSEO(selectedProject);
        if (auto) setSeoForm(auto);
      }
    }
  }, [selectedProject, generateProjectSEO, baseUrl, profileConfig]);

  // Handle Form Change
  const handleInputChange = (field, value) => {
    setSeoForm((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-generate button for current project
  const handleAutoGenerateCurrent = (tone = 'balanced') => {
    if (!selectedProject) return;
    const generated = generateProjectSEO(selectedProject, tone);
    if (generated) {
      setSeoForm(generated);
      setSaveStatus({
        type: 'info',
        message: `Generated automated ${tone} SEO meta-tags for "${selectedProject.title}". Click "Save to Database" to commit.`,
      });
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // Batch auto-generate for all projects
  const handleBatchGenerateAll = async () => {
    if (!projectsList || projectsList.length === 0) return;
    setIsSaving(true);
    let count = 0;
    try {
      for (const proj of projectsList) {
        const generated = generateProjectSEO(proj, 'balanced');
        if (generated && onUpdateProjectSEO) {
          await onUpdateProjectSEO(proj.id, generated);
          count++;
        }
      }
      setSaveStatus({
        type: 'success',
        message: `Successfully generated and saved SEO meta-tags for all ${count} projects to Database!`,
      });
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: `Error updating batch SEO: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 5000);
    }
  };

  // Save current project's SEO
  const handleSaveSEO = async () => {
    if (!selectedProject || !onUpdateProjectSEO) return;
    setIsSaving(true);
    try {
      const success = await onUpdateProjectSEO(selectedProject.id, seoForm);
      if (success !== false) {
        setSaveStatus({
          type: 'success',
          message: `SEO Metadata for "${selectedProject.title}" saved successfully to MongoDB & Cloud Firestore!`,
        });
      } else {
        setSaveStatus({
          type: 'error',
          message: 'Failed to save SEO meta-tags. Please check console.',
        });
      }
    } catch (err) {
      setSaveStatus({
        type: 'error',
        message: `Save error: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  // HTML Head Tags generation
  const generatedHtmlSnippet = useMemo(() => {
    const title = seoForm.metaTitle || (selectedProject ? selectedProject.title : 'Project');
    const desc = seoForm.metaDescription || (selectedProject ? selectedProject.description : '');
    const img = seoForm.ogImage || (selectedProject ? selectedProject.image : '');
    const fullImgUrl = img.startsWith('http') ? img : `${baseUrl}${img}`;
    const url = seoForm.canonicalUrl || `${baseUrl}/#projects`;

    return `<!-- Standard SEO -->
<title>${title}</title>
<meta name="description" content="${desc}" />
<meta name="keywords" content="${seoForm.keywords}" />
<meta name="robots" content="${seoForm.robots}" />
<link rel="canonical" href="${url}" />

<!-- OpenGraph / Facebook / LinkedIn / WhatsApp -->
<meta property="og:type" content="website" />
<meta property="og:url" content="${url}" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:image" content="${fullImgUrl}" />
<meta property="og:site_name" content="${profileConfig?.name || 'Sachin Kumar'} Portfolio" />

<!-- Twitter / X Card -->
<meta name="twitter:card" content="${seoForm.twitterCard}" />
<meta name="twitter:url" content="${url}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${fullImgUrl}" />
<meta name="twitter:creator" content="@sachin_dev" />`;
  }, [seoForm, selectedProject, baseUrl, profileConfig]);

  // JSON-LD Structured Data Schema
  const generatedJsonLd = useMemo(() => {
    const title = seoForm.metaTitle || (selectedProject ? selectedProject.title : 'Project');
    const desc = seoForm.metaDescription || (selectedProject ? selectedProject.description : '');
    const url = seoForm.canonicalUrl || `${baseUrl}/#projects`;
    const techArray = selectedProject && Array.isArray(selectedProject.technologies)
      ? selectedProject.technologies
      : (seoForm.keywords ? seoForm.keywords.split(',').map((s) => s.trim()) : []);

    const schema = {
      '@context': 'https://schema.org',
      '@type': seoForm.schemaType || 'WebApplication',
      name: title,
      description: desc,
      url: url,
      applicationCategory: selectedProject?.category || 'DeveloperApplication',
      operatingSystem: 'All Modern Web Browsers',
      author: {
        '@type': 'Person',
        name: seoForm.author || profileConfig?.name || 'Sachin Kumar',
        url: baseUrl,
      },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      keywords: techArray.join(', '),
    };

    return JSON.stringify(schema, null, 2);
  }, [seoForm, selectedProject, baseUrl, profileConfig]);

  // Copy to clipboard helper
  const handleCopyToClipboard = (text, type) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch {
      // fallback
    }
  };

  // Character count color helpers
  const titleLen = (seoForm.metaTitle || '').length;
  const descLen = (seoForm.metaDescription || '').length;

  const getTitleStatus = () => {
    if (titleLen === 0) return { color: 'text-gray-400', label: 'Empty' };
    if (titleLen >= 30 && titleLen <= 60)
      return { color: 'status-optimal', label: 'Optimal (30–60 chars)' };
    if (titleLen > 60)
      return { color: 'status-warning', label: 'Too long (may truncate)' };
    return { color: 'status-short', label: 'A bit short' };
  };

  const getDescStatus = () => {
    if (descLen === 0) return { color: 'text-gray-400', label: 'Empty' };
    if (descLen >= 120 && descLen <= 160)
      return { color: 'status-optimal', label: 'Optimal (120–160 chars)' };
    if (descLen > 160)
      return { color: 'status-warning', label: 'Too long (will be cut off)' };
    return { color: 'status-short', label: 'Too short (under 120 chars)' };
  };

  const titleStatus = getTitleStatus();
  const descStatus = getDescStatus();

  return (
    <div className="seo-generator-tab-content">
      {/* 1. Header Banner & Actions */}
      <div className="seo-tool-header">
        <div className="seo-tool-header-info">
          <div className="seo-badge-row">
            <span className="badge-seo-pro">
              <Globe size={13} />
              SEO & Social Automation Tool
            </span>
            <span className="badge-seo-sub">
              OpenGraph • Twitter Cards • Google SERP • Schema.org
            </span>
          </div>
          <h2>Automated Project SEO & Social Share Generator</h2>
          <p>
            Easily craft, automate, and preview high-ranking SEO meta tags, OpenGraph social cards,
            and Schema.org JSON-LD structured data for every portfolio project.
          </p>
        </div>

        <div className="seo-header-actions">
          <button
            type="button"
            className="btn-batch-generate"
            onClick={handleBatchGenerateAll}
            disabled={isSaving}
            title="Automatically generate and save optimal SEO metadata for all projects"
          >
            <Sparkles size={16} />
            <span>Auto-Generate All ({projectsList.length})</span>
          </button>
          <button
            type="button"
            className="btn-save-seo-main"
            onClick={handleSaveSEO}
            disabled={isSaving || !selectedProject}
          >
            {isSaving ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            <span>Save to Database</span>
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {saveStatus && (
        <div className={`seo-status-banner ${saveStatus.type}`}>
          {saveStatus.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : saveStatus.type === 'info' ? (
            <Sparkles size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{saveStatus.message}</span>
        </div>
      )}

      {/* 2. Project Selector Bar */}
      <div className="seo-project-selector-bar">
        <div className="selector-label">
          <Layers size={16} />
          <span>Select Project:</span>
        </div>
        <div className="project-chips-scroll">
          {projectsList.map((p) => {
            const isSelected = p.id === (selectedProject?.id || selectedProjectId);
            const hasCustomSeo = p.seo && p.seo.metaTitle;
            return (
              <button
                key={p.id}
                type="button"
                className={`project-selector-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedProjectId(p.id)}
              >
                <span className="chip-title">{p.title}</span>
                {hasCustomSeo ? (
                  <span className="chip-seo-status active" title="Custom SEO Saved">
                    SEO ✓
                  </span>
                ) : (
                  <span className="chip-seo-status default" title="Default SEO">
                    Auto
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Main Workspace Grid: Left Form, Right Live Previews */}
      <div className="seo-workspace-grid">
        {/* Left Column: Form Controls & Presets */}
        <div className="seo-form-panel">
          <div className="seo-panel-header">
            <div className="panel-title-with-actions">
              <h3>
                <Sliders size={18} />
                <span>SEO Parameters for "{selectedProject?.title}"</span>
              </h3>
              <div className="preset-buttons-group">
                <span className="preset-label">Magic Auto-Fill:</span>
                <button
                  type="button"
                  className="btn-preset-pill"
                  onClick={() => handleAutoGenerateCurrent('balanced')}
                  title="Generate balanced SEO description (140-155 chars)"
                >
                  <Sparkles size={12} />
                  <span>Balanced</span>
                </button>
                <button
                  type="button"
                  className="btn-preset-pill"
                  onClick={() => handleAutoGenerateCurrent('recruiter')}
                  title="Tailor for recruiters and hiring managers"
                >
                  <span>Recruiter</span>
                </button>
                <button
                  type="button"
                  className="btn-preset-pill"
                  onClick={() => handleAutoGenerateCurrent('technical')}
                  title="Tailor for deep technical keywords"
                >
                  <span>Technical</span>
                </button>
              </div>
            </div>
          </div>

          <div className="seo-form-body">
            {/* Meta Title */}
            <div className="form-field-group">
              <div className="field-label-row">
                <label htmlFor="metaTitle">
                  <strong>Meta Page Title (`&lt;title&gt;` & `og:title`)</strong>
                </label>
                <div className={`char-counter ${titleStatus.color}`}>
                  <span>{titleLen} / 60 chars</span>
                  <span className="char-badge">{titleStatus.label}</span>
                </div>
              </div>
              <input
                id="metaTitle"
                type="text"
                className="seo-input"
                value={seoForm.metaTitle}
                onChange={(e) => handleInputChange('metaTitle', e.target.value)}
                placeholder="e.g. Brain Tumor Segmentation – AI & Deep Learning Project | Sachin Kumar"
              />
              <p className="field-hint">
                Keep between 30 and 60 characters for best ranking in Google SERPs without clipping.
              </p>
            </div>

            {/* Meta Description */}
            <div className="form-field-group">
              <div className="field-label-row">
                <label htmlFor="metaDescription">
                  <strong>Meta Description (`&lt;meta name="description"&gt;` & `og:description`)</strong>
                </label>
                <div className={`char-counter ${descStatus.color}`}>
                  <span>{descLen} / 160 chars</span>
                  <span className="char-badge">{descStatus.label}</span>
                </div>
              </div>
              <textarea
                id="metaDescription"
                className="seo-textarea"
                rows={4}
                value={seoForm.metaDescription}
                onChange={(e) => handleInputChange('metaDescription', e.target.value)}
                placeholder="Write a compelling 120-160 character summary that entices clicks from Google and LinkedIn..."
              />
              <p className="field-hint">
                Target 120–160 characters. Clearly state the project's purpose, core technologies, and call-to-action.
              </p>
            </div>

            {/* Keywords */}
            <div className="form-field-group">
              <label htmlFor="seoKeywords">
                <strong>Target Keywords / Tech Stack Tags</strong>
              </label>
              <input
                id="seoKeywords"
                type="text"
                className="seo-input"
                value={seoForm.keywords}
                onChange={(e) => handleInputChange('keywords', e.target.value)}
                placeholder="React, Machine Learning, TensorFlow, Node.js, Sachin Kumar"
              />
              <p className="field-hint">
                Comma-separated high-intent keywords search engines and portfolio indexes index.
              </p>
            </div>

            {/* Row of 2: Canonical URL and OG Image */}
            <div className="form-row-2">
              <div className="form-field-group">
                <label htmlFor="canonicalUrl">Canonical URL</label>
                <input
                  id="canonicalUrl"
                  type="text"
                  className="seo-input"
                  value={seoForm.canonicalUrl}
                  onChange={(e) => handleInputChange('canonicalUrl', e.target.value)}
                  placeholder="https://sachinkumar.dev/#projects"
                />
              </div>

              <div className="form-field-group">
                <label htmlFor="ogImage">OG Social Image Banner URL</label>
                <input
                  id="ogImage"
                  type="text"
                  className="seo-input"
                  value={seoForm.ogImage}
                  onChange={(e) => handleInputChange('ogImage', e.target.value)}
                  placeholder="/assets/aistudio/projects-bg_f9111c06.png"
                />
              </div>
            </div>

            {/* Row of 3: Twitter Card, Schema Type, Robots */}
            <div className="form-row-3">
              <div className="form-field-group">
                <label htmlFor="twitterCard">Twitter Card Type</label>
                <select
                  id="twitterCard"
                  className="seo-select"
                  value={seoForm.twitterCard}
                  onChange={(e) => handleInputChange('twitterCard', e.target.value)}
                >
                  <option value="summary_large_image">Large Image Card (Recommended)</option>
                  <option value="summary">Small Summary Card</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="schemaType">Schema.org JSON-LD Type</label>
                <select
                  id="schemaType"
                  className="seo-select"
                  value={seoForm.schemaType}
                  onChange={(e) => handleInputChange('schemaType', e.target.value)}
                >
                  <option value="WebApplication">WebApplication</option>
                  <option value="SoftwareApplication">SoftwareApplication</option>
                  <option value="CreativeWork">CreativeWork</option>
                </select>
              </div>

              <div className="form-field-group">
                <label htmlFor="robots">Robots Indexing</label>
                <select
                  id="robots"
                  className="seo-select"
                  value={seoForm.robots}
                  onChange={(e) => handleInputChange('robots', e.target.value)}
                >
                  <option value="index, follow">index, follow (Standard)</option>
                  <option value="noindex, follow">noindex, follow</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Live Social Share Previews */}
        <div className="seo-preview-panel">
          <div className="seo-panel-header">
            <div className="preview-nav-tabs">
              <button
                type="button"
                className={`preview-tab-btn ${previewPlatform === 'google' ? 'active' : ''}`}
                onClick={() => setPreviewPlatform('google')}
              >
                <Search size={15} />
                <span>Google SERP</span>
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewPlatform === 'linkedin' ? 'active' : ''}`}
                onClick={() => setPreviewPlatform('linkedin')}
              >
                <Share2 size={15} />
                <span>LinkedIn / FB</span>
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewPlatform === 'twitter' ? 'active' : ''}`}
                onClick={() => setPreviewPlatform('twitter')}
              >
                <span className="twitter-x-logo">𝕏</span>
                <span>Twitter / X</span>
              </button>
              <button
                type="button"
                className={`preview-tab-btn ${previewPlatform === 'discord' ? 'active' : ''}`}
                onClick={() => setPreviewPlatform('discord')}
              >
                <Eye size={15} />
                <span>Discord / Slack</span>
              </button>
            </div>
          </div>

          <div className="preview-canvas-container">
            {/* 1. GOOGLE SERP PREVIEW */}
            {previewPlatform === 'google' && (
              <div className="preview-box google-serp-box">
                <div className="preview-controls-bar">
                  <span className="preview-title-tag">Google Search Result Snippet</span>
                  <div className="device-toggles">
                    <button
                      type="button"
                      className={`device-btn ${googleDevice === 'desktop' ? 'active' : ''}`}
                      onClick={() => setGoogleDevice('desktop')}
                    >
                      <Monitor size={14} />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      className={`device-btn ${googleDevice === 'mobile' ? 'active' : ''}`}
                      onClick={() => setGoogleDevice('mobile')}
                    >
                      <Smartphone size={14} />
                      <span>Mobile</span>
                    </button>
                  </div>
                </div>

                <div className={`serp-card ${googleDevice}`}>
                  {/* Google Breadcrumb */}
                  <div className="serp-breadcrumb">
                    <div className="serp-favicon">
                      <Globe size={13} />
                    </div>
                    <div className="serp-url-texts">
                      <span className="serp-site-name">{profileConfig?.name || 'Sachin Kumar'}</span>
                      <span className="serp-display-url">
                        {seoForm.canonicalUrl || `${baseUrl}/#projects`}
                      </span>
                    </div>
                  </div>

                  {/* Clickable Blue Title */}
                  <h4 className="serp-title">
                    {seoForm.metaTitle || `${selectedProject?.title} – Sachin Kumar`}
                  </h4>

                  {/* Meta Description */}
                  <p className="serp-snippet">
                    <span className="serp-date">
                      {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} —{' '}
                    </span>
                    {seoForm.metaDescription ||
                      'Discover the project architecture, features, and source code on Sachin Kumar portfolio website.'}
                  </p>
                </div>

                <div className="serp-advice">
                  <small>
                    💡 Search engines truncate titles past ~600px (~60 chars) and descriptions past ~160 chars.
                  </small>
                </div>
              </div>
            )}

            {/* 2. LINKEDIN & FACEBOOK PREVIEW */}
            {previewPlatform === 'linkedin' && (
              <div className="preview-box linkedin-share-box">
                <div className="preview-controls-bar">
                  <span className="preview-title-tag">LinkedIn & Facebook Post Card</span>
                </div>

                <div className="social-card-mockup linkedin-mockup">
                  <div className="social-card-img-container">
                    <img
                      src={seoForm.ogImage || selectedProject?.image || '/assets/aistudio/projects-bg_f9111c06.png'}
                      alt={seoForm.metaTitle}
                      className="social-banner-image"
                      onError={(e) => {
                        e.target.src = '/assets/aistudio/projects-bg_f9111c06.png';
                      }}
                    />
                    <span className="card-aspect-ratio-badge">1200 x 630 (1.91:1)</span>
                  </div>
                  <div className="social-card-content">
                    <span className="social-domain-badge">{siteDomain.toUpperCase()}</span>
                    <h4 className="social-card-title">{seoForm.metaTitle || selectedProject?.title}</h4>
                    <p className="social-card-description">{seoForm.metaDescription}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. TWITTER / X CARD PREVIEW */}
            {previewPlatform === 'twitter' && (
              <div className="preview-box twitter-share-box">
                <div className="preview-controls-bar">
                  <span className="preview-title-tag">𝕏 / Twitter Summary Card</span>
                  <div className="device-toggles">
                    <button
                      type="button"
                      className={`device-btn ${twitterTheme === 'dark' ? 'active' : ''}`}
                      onClick={() => setTwitterTheme('dark')}
                    >
                      <span>Dark 𝕏</span>
                    </button>
                    <button
                      type="button"
                      className={`device-btn ${twitterTheme === 'light' ? 'active' : ''}`}
                      onClick={() => setTwitterTheme('light')}
                    >
                      <span>Light</span>
                    </button>
                  </div>
                </div>

                <div className={`twitter-card-mockup ${twitterTheme}`}>
                  <div className="twitter-img-wrap">
                    <img
                      src={seoForm.ogImage || selectedProject?.image || '/assets/aistudio/projects-bg_f9111c06.png'}
                      alt={seoForm.metaTitle}
                      className="twitter-banner-image"
                      onError={(e) => {
                        e.target.src = '/assets/aistudio/projects-bg_f9111c06.png';
                      }}
                    />
                    <div className="twitter-domain-chip">{siteDomain}</div>
                  </div>
                  <div className="twitter-content-wrap">
                    <h4 className="twitter-card-title">{seoForm.metaTitle || selectedProject?.title}</h4>
                    <p className="twitter-card-description">{seoForm.metaDescription}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DISCORD & SLACK EMBED PREVIEW */}
            {previewPlatform === 'discord' && (
              <div className="preview-box discord-share-box">
                <div className="preview-controls-bar">
                  <span className="preview-title-tag">Discord & Slack Rich Embed</span>
                </div>

                <div className="discord-embed-mockup">
                  <div className="discord-accent-bar" />
                  <div className="discord-embed-body">
                    <div className="discord-site-title">{profileConfig?.name || 'Sachin Kumar'} Portfolio</div>
                    <a href="#preview" className="discord-title-link" onClick={(e) => e.preventDefault()}>
                      {seoForm.metaTitle || selectedProject?.title}
                    </a>
                    <p className="discord-description">{seoForm.metaDescription}</p>

                    <div className="discord-embed-img-wrap">
                      <img
                        src={seoForm.ogImage || selectedProject?.image || '/assets/aistudio/projects-bg_f9111c06.png'}
                        alt={seoForm.metaTitle}
                        className="discord-banner-image"
                        onError={(e) => {
                          e.target.src = '/assets/aistudio/projects-bg_f9111c06.png';
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Code Export Tabs */}
          <div className="seo-code-export-area">
            <div className="export-tabs-row">
              <span className="export-heading">
                <Code size={15} />
                Export Generated Code:
              </span>
              <div className="export-action-btns">
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={() => handleCopyToClipboard(generatedHtmlSnippet, 'html')}
                >
                  {copiedType === 'html' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedType === 'html' ? 'Copied HTML!' : 'Copy <head> HTML'}</span>
                </button>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={() => handleCopyToClipboard(generatedJsonLd, 'jsonld')}
                >
                  {copiedType === 'jsonld' ? <Check size={14} /> : <FileText size={14} />}
                  <span>{copiedType === 'jsonld' ? 'Copied JSON-LD!' : 'Copy Schema JSON-LD'}</span>
                </button>
              </div>
            </div>

            <pre className="code-snippet-preview">
              <code>{generatedHtmlSnippet}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSeoGeneratorTab;
