/**
 * Server-side Data Models & Validation Schemas for Portfolio Collections
 * Enforces strict input validation and sanitization before writing to MongoDB.
 */

export const sanitizeString = (val, maxLength = 5000) => {
  if (val === null || val === undefined) return '';
  return String(val).trim().slice(0, maxLength);
};

export const sanitizeStringArray = (val) => {
  if (Array.isArray(val)) {
    return val
      .map((item) => sanitizeString(item, 200))
      .filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return val
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export const sanitizeUrl = (val, fallback = '#') => {
  if (!val || typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '#') return '#';
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:application/pdf') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

/**
 * Helper to return both { valid, sanitized } and { isValid, value } for full compatibility
 */
const buildValidationResult = (errors, sanitized) => {
  const isValid = errors.length === 0;
  return {
    valid: isValid,
    isValid,
    errors,
    sanitized: isValid ? sanitized : null,
    value: isValid ? sanitized : null,
  };
};

/**
 * 1. Project Schema Validator
 */
export const validateProject = (data = {}, isUpdate = false) => {
  const errors = [];

  const title = sanitizeString(data.title, 200);
  const description = sanitizeString(data.description, 5000);
  const category = sanitizeString(data.category || 'Full Stack & MERN Architecture', 120);

  if (!isUpdate || data.title !== undefined) {
    if (!title || title.length < 1) {
      errors.push('Project title is required.');
    }
  }

  if (!isUpdate || data.description !== undefined) {
    if (!description || description.length < 1) {
      errors.push('Project description is required.');
    }
  }

  const technologies = sanitizeStringArray(data.technologies || data.tech || data.tags || []);
  const features = Array.isArray(data.features)
    ? data.features.map((f) => sanitizeString(f, 500)).filter(Boolean)
    : [];

  const liveUrl = sanitizeUrl(data.live || data.liveUrl || data.demoUrl || data.demoLink || '#');
  const githubUrl = sanitizeUrl(data.github || data.githubUrl || data.githubLink || '#');

  const sanitized = {
    title,
    description,
    category,
    technologies: technologies.length > 0 ? technologies : ['React', 'JavaScript', 'Node.js'],
    tech: technologies.length > 0 ? technologies : ['React', 'JavaScript', 'Node.js'],
    tags: technologies.length > 0 ? technologies : ['React', 'JavaScript', 'Node.js'],
    features,
    github: githubUrl,
    githubUrl,
    githubLink: githubUrl,
    live: liveUrl,
    liveUrl,
    demoUrl: liveUrl,
    demoLink: liveUrl,
    image: sanitizeUrl(
      data.image || '/images/My_portfolio.png',
      '/images/My_portfolio.png'
    ),
    featured: data.featured !== undefined ? Boolean(data.featured) : true,
    status: sanitizeString(data.status || 'Completed', 50),
  };

  if (data.seo && typeof data.seo === 'object') {
    sanitized.seo = data.seo;
  }

  return buildValidationResult(errors, sanitized);
};

/**
 * 2. Certification Schema Validator
 */
export const validateCertification = (data = {}, isUpdate = false) => {
  const errors = [];

  const title = sanitizeString(data.title, 250);
  const issuer = sanitizeString(data.issuer || data.organization, 200);
  const category = sanitizeString(data.category || 'web', 100);

  if (!isUpdate || data.title !== undefined) {
    if (!title || title.length < 1) {
      errors.push('Certification title is required.');
    }
  }

  if (!isUpdate || (data.issuer !== undefined || data.organization !== undefined)) {
    if (!issuer || issuer.length < 1) {
      errors.push('Certification issuer/organization is required.');
    }
  }

  const rawImage = data.image ? String(data.image).trim() : '';
  const rawFile = data.file ? String(data.file).trim() : '';
  const rawPreview = data.preview ? String(data.preview).trim() : '';
  const rawLink = data.link || data.credentialUrl || data.verifyUrl || '';

  const primaryDoc =
    rawImage || rawFile || rawPreview || '/certificates/previews/ibm-web-dev.png';
  const fileDoc = rawFile || rawImage || rawLink || primaryDoc;
  const previewDoc = rawPreview || rawImage || primaryDoc;
  const linkDoc = rawLink ? sanitizeUrl(String(rawLink), fileDoc) : fileDoc;

  const sanitized = {
    title,
    issuer,
    date: sanitizeString(data.date || data.issueDate || new Date().getFullYear().toString(), 50),
    category,
    categoryLabel: sanitizeString(data.categoryLabel || 'Professional Certification', 120),
    credentialId: sanitizeString(data.credentialId || '', 150),
    image: sanitizeUrl(primaryDoc, '/certificates/previews/ibm-web-dev.png'),
    file: sanitizeUrl(fileDoc, '/certificates/previews/ibm-web-dev.png'),
    preview: sanitizeUrl(previewDoc, '/certificates/previews/ibm-web-dev.png'),
    link: linkDoc,
    credentialUrl: linkDoc,
    verifyUrl: linkDoc,
    skills: sanitizeStringArray(data.skills || []),
    featured: Boolean(data.featured),
  };

  return buildValidationResult(errors, sanitized);
};

/**
 * 3. Education Schema Validator
 */
export const validateEducation = (data = {}, isUpdate = false) => {
  const errors = [];

  const degree = sanitizeString(data.degree || data.title, 250);
  const institution = sanitizeString(data.institution || data.institute || data.school || data.company || '', 250);
  const period = sanitizeString(data.period || data.duration || data.year || '2023 - 2027', 100);

  if (!isUpdate || (data.degree !== undefined || data.title !== undefined)) {
    if (!degree || degree.length < 1) {
      errors.push('Degree or qualification title is required.');
    }
  }

  if (!isUpdate || (data.institution !== undefined || data.institute !== undefined || data.school !== undefined)) {
    if (!institution || institution.length < 1) {
      errors.push('Institution / University name is required.');
    }
  }

  const rawHighlights = data.highlights || data.description || data.details || [];
  const highlightsArray = Array.isArray(rawHighlights)
    ? rawHighlights.map((d) => sanitizeString(d, 1000)).filter(Boolean)
    : typeof rawHighlights === 'string' && rawHighlights.trim()
    ? rawHighlights
        .split('\n')
        .map((d) => sanitizeString(d, 1000))
        .filter(Boolean)
    : [];

  const skillsArray = sanitizeStringArray(data.skills || data.tech || data.courses || []);
  const category = sanitizeString(data.category || 'engineering', 100);

  const sanitized = {
    degree,
    title: degree,
    institution,
    institute: institution,
    company: institution,
    location: sanitizeString(data.location || 'India', 150),
    period,
    duration: period,
    year: period,
    grade: sanitizeString(data.grade || data.cgpa || '', 100),
    status: sanitizeString(data.status || 'Pursuing (Undergraduate)', 120),
    category,
    categoryLabel: sanitizeString(
      data.categoryLabel || (category === 'sciences' ? 'Mathematical Sciences' : 'Engineering & Technology'),
      120
    ),
    description: highlightsArray,
    highlights: highlightsArray,
    details: highlightsArray,
    skills: skillsArray,
    tech: skillsArray,
    courses: skillsArray,
  };

  return buildValidationResult(errors, sanitized);
};

/**
 * 4. Experience Schema Validator
 */
export const validateExperience = (data = {}, isUpdate = false) => {
  const errors = [];

  const role = sanitizeString(data.role || data.title || data.position, 250);
  const company = sanitizeString(data.company || data.organization, 250);
  const period = sanitizeString(data.period || data.duration || 'Present', 100);

  if (!isUpdate || (data.role !== undefined || data.title !== undefined || data.position !== undefined)) {
    if (!role || role.length < 1) {
      errors.push('Role / Position title is required.');
    }
  }

  if (!isUpdate || (data.company !== undefined || data.organization !== undefined)) {
    if (!company || company.length < 1) {
      errors.push('Company / Organization name is required.');
    }
  }

  const rawDesc = data.description || data.details || [];
  const descriptionArray = Array.isArray(rawDesc)
    ? rawDesc.map((d) => sanitizeString(d, 1000)).filter(Boolean)
    : typeof rawDesc === 'string' && rawDesc.trim()
    ? rawDesc
        .split('\n')
        .map((d) => sanitizeString(d, 1000))
        .filter(Boolean)
    : [];

  const skillsArray = sanitizeStringArray(data.skills || data.tech || data.technologies || []);
  const category = sanitizeString(data.category || 'ai', 100);

  let sanitizedCert = null;
  if (data.certificate && typeof data.certificate === 'object') {
    const certFile = sanitizeUrl(
      data.certificate.file || data.certificate.image || data.certificate.preview || '',
      ''
    );
    if (certFile) {
      const isDataPdf = certFile.startsWith('data:application/pdf');
      const rawPreview = sanitizeUrl(data.certificate.preview || '', '');
      const rawImage = sanitizeUrl(data.certificate.image || '', '');
      sanitizedCert = {
        id: sanitizeString(data.certificate.id || `cert_${Date.now()}`, 100),
        title: sanitizeString(data.certificate.title || `${role} - ${company} Certificate`, 250),
        issuer: sanitizeString(data.certificate.issuer || company, 200),
        date: sanitizeString(data.certificate.date || period, 100),
        file: certFile,
        preview: rawPreview || (isDataPdf ? '' : certFile),
        image: rawImage || (isDataPdf ? '' : certFile),
      };
    }
  } else if (typeof data.certificate === 'string' && data.certificate.trim()) {
    const certFile = sanitizeUrl(data.certificate.trim(), '');
    if (certFile && certFile !== '#') {
      const isDataPdf = certFile.startsWith('data:application/pdf');
      sanitizedCert = {
        id: `cert_${Date.now()}`,
        title: `${role} - ${company} Certificate`,
        issuer: company,
        date: period,
        file: certFile,
        preview: isDataPdf ? '' : certFile,
        image: isDataPdf ? '' : certFile,
      };
    }
  }

  const sanitized = {
    role,
    title: role,
    company,
    location: sanitizeString(data.location || 'Remote', 150),
    period,
    duration: period,
    type: sanitizeString(data.type || 'Internship', 100),
    category,
    categoryLabel: sanitizeString(
      data.categoryLabel || (category === 'ai' ? 'AI & Machine Learning' : 'Web & Full Stack'),
      120
    ),
    description: descriptionArray,
    details: descriptionArray,
    achievements: Array.isArray(data.achievements)
      ? data.achievements.map((a) => sanitizeString(a, 500)).filter(Boolean)
      : [],
    technologies: skillsArray,
    skills: skillsArray,
    tech: skillsArray,
    certificate: sanitizedCert,
    featured: Boolean(data.featured),
  };

  return buildValidationResult(errors, sanitized);
};

/**
 * 5. Skill Schema Validator
 */
export const validateSkill = (data = {}, isUpdate = false) => {
  const errors = [];

  const name = sanitizeString(data.name || data.title, 120);
  const category = sanitizeString(data.category || data.domainTitle || data.domainId || 'Frontend Development', 120);
  const domainId = sanitizeString(data.domainId || 'frontend', 100);

  if (!isUpdate || (data.name !== undefined || data.title !== undefined)) {
    if (!name || name.length < 1) {
      errors.push('Skill name is required.');
    }
  }

  const levelNum = Number(data.proficiency ?? data.percentage ?? 85);
  const proficiency = Number.isFinite(levelNum) ? Math.min(100, Math.max(10, levelNum)) : 85;
  const isHighlighted =
    data.highlight !== undefined
      ? Boolean(data.highlight)
      : data.featured !== undefined
      ? Boolean(data.featured)
      : false;

  const sanitized = {
    name,
    category,
    domainId,
    domainTitle: sanitizeString(data.domainTitle || category, 120),
    level: sanitizeString(data.level || 'Advanced', 50),
    proficiency,
    icon: sanitizeString(data.icon || 'fas fa-code', 150),
    highlight: isHighlighted,
    featured: isHighlighted,
  };

  return buildValidationResult(errors, sanitized);
};

/**
 * 6. Contact Message Schema Validator
 */
export const validateContactMessage = (data = {}) => {
  const errors = [];

  const name = sanitizeString(data.name, 120);
  const email = sanitizeString(data.email, 150);
  const subject = sanitizeString(data.subject || 'Portfolio Inquiry', 250);
  const message = sanitizeString(data.message, 5000);

  if (!name || name.length < 2) {
    errors.push('Your name is required.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('A valid email address is required.');
  }

  if (!message || message.length < 3) {
    errors.push('Please enter a message.');
  }

  const sanitized = {
    name,
    email: email.toLowerCase(),
    subject,
    message,
    status: 'unread',
  };

  return buildValidationResult(errors, sanitized);
};
