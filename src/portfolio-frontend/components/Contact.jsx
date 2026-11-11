import React, { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';
import { personalInfo, socialLinks } from '../../data/portfolioData.js';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { buildApiUrl } from '../../config/api.js';
import { usePortfolioBackend, notifyRealtimeUpdate } from '../../context/PortfolioBackendContext.jsx';

export const Contact = () => {
  const { submitContactMessage, refreshPortfolioData } = usePortfolioBackend();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'Job Opportunity for Full-Stack / AI Developer',
    message: '',
  });

  const [inquiryType, setInquiryType] = useState('job');
  const [copiedField, setCopiedField] = useState(null);
  const [currentTime, setCurrentTime] = useState('');
  const [status, setStatus] = useState({ type: null, message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Dynamic Indian Standard Time clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        setCurrentTime(`${timeString} IST (UTC+5:30)`);
      } catch {
        setCurrentTime('IST (UTC+5:30)');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const inquiryTypes = [
    { id: 'job', label: 'Full-Time Role', icon: 'fas fa-briefcase', defaultSubject: 'Job Opportunity for Full-Stack / AI Developer' },
    { id: 'freelance', label: 'Freelance Project', icon: 'fas fa-laptop-code', defaultSubject: 'New Freelance / Contract Project Inquiry' },
    { id: 'collaboration', label: 'Collaboration', icon: 'fas fa-handshake', defaultSubject: 'Tech Collaboration / Open Source Project' },
    { id: 'general', label: 'Say Hello', icon: 'fas fa-comment-dots', defaultSubject: 'Hello from your Portfolio!' },
  ];

  const quickStarters = [
    {
      label: 'Job Opportunity',
      text: `Hi Sachin, I reviewed your portfolio and would like to discuss an opportunity for a Full-Stack / AI Engineer role on our team.`,
      type: 'job',
    },
    {
      label: 'Web / App Project',
      text: `Hi Sachin, I have an upcoming project and would like to consult with you about building a web application.`,
      type: 'freelance',
    },
    {
      label: 'AI / ML Collaboration',
      text: `Hi Sachin, loved your work on Deep Learning & Web apps! Would you be interested in collaborating on an innovative project?`,
      type: 'collaboration',
    },
  ];

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInquiryChange = (type) => {
    setInquiryType(type.id);
    if (!formData.subject || inquiryTypes.some((t) => t.defaultSubject === formData.subject)) {
      setFormData((prev) => ({ ...prev, subject: type.defaultSubject }));
    }
  };

  const handleTemplateClick = (starter) => {
    setInquiryType(starter.type);
    setFormData((prev) => ({
      ...prev,
      subject: starter.type === 'job' 
        ? 'Job Opportunity for Full-Stack / AI Developer'
        : starter.type === 'freelance'
        ? 'New Freelance / Contract Project Inquiry'
        : 'Tech Collaboration / Project Inquiry',
      message: starter.text,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (status.type === 'error') {
      setStatus({ type: null, message: '' });
    }
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const selectedTypeObj = inquiryTypes.find((t) => t.id === inquiryType);
    const effectiveSubject =
      formData.subject.trim() ||
      selectedTypeObj?.defaultSubject ||
      'Portfolio Contact Inquiry';

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.message.trim()
    ) {
      setStatus({
        type: 'error',
        message: 'Please complete your Name, Email, and Message.',
      });
      return;
    }

    if (!isValidEmail(formData.email)) {
      setStatus({
        type: 'error',
        message: 'Please provide a valid email address so I can reply back.',
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: null, message: '' });

    try {
      const payload = {
        inquiryType,
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: effectiveSubject,
        message: formData.message.trim(),
      };

      // 1. Send to Formspree using FormData (avoids CORS preflight blocks in browsers/iframes)
      let clientEmailSent = false;
      try {
        const formPayload = new FormData();
        formPayload.append('name', payload.name);
        formPayload.append('email', payload.email);
        formPayload.append('subject', `[${inquiryType.toUpperCase()}] ${effectiveSubject} - from ${payload.name}`);
        formPayload.append('inquiryType', inquiryType);
        formPayload.append('message', payload.message);
        formPayload.append('_replyto', payload.email);
        formPayload.append('_subject', `[${inquiryType.toUpperCase()}] ${effectiveSubject} - from ${payload.name}`);

        const formspreeRes = await fetch('https://formspree.io/f/xrbykkkb', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
          },
          body: formPayload,
        });
        clientEmailSent = formspreeRes.ok;
      } catch {
        clientEmailSent = false;
      }

      // 2. Save to Express + MongoDB Backend API (also sends email from server if clientEmailSent is false)
      let dbSaved = false;
      let dbError = null;
      try {
        if (submitContactMessage) {
          await submitContactMessage({ ...payload, emailAlreadySent: clientEmailSent });
          dbSaved = true;
        } else {
          const backendRes = await fetch(buildApiUrl('/api/contact'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ...payload, emailAlreadySent: clientEmailSent }),
          });
          const resJson = await backendRes.json().catch(() => ({}));
          if (!backendRes.ok || resJson.success === false) {
            throw new Error(resJson.error || 'Failed to store message in database.');
          }
          dbSaved = true;
          notifyRealtimeUpdate('messages');
        }

        if (refreshPortfolioData) {
          refreshPortfolioData();
        }
      } catch (err) {
        dbError = err;
      }

      if (!dbSaved && !clientEmailSent) {
        throw dbError || new Error('Failed to send message. Please check your connection and try again.');
      }

      setFormData((prev) => ({ ...prev, subject: effectiveSubject }));
      setIsSubmitted(true);
      setStatus({
        type: 'success',
        message: `Thank you, ${formData.name}! Your message has been saved to the database and emailed to Sachin Kumar (${personalInfo.email}).`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        message:
          err?.message ||
          'Oops! There was a problem sending your message. Please retry or contact me directly via email.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const selectedTypeObj = inquiryTypes.find((t) => t.id === inquiryType);
    setFormData({
      name: '',
      email: '',
      subject: selectedTypeObj?.defaultSubject || 'Job Opportunity for Full-Stack / AI Developer',
      message: '',
    });
    setIsSubmitted(false);
    setStatus({ type: null, message: '' });
  };

  const messageLength = formData.message.length;
  const wordCount = formData.message.trim() ? formData.message.trim().split(/\s+/).length : 0;

  return (
    <section id="contact" className="contact-modern-section">
      <SectionTechBackground type="contact" />
      <div className="container">
        {/* Section Heading */}
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <Mail className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">Get In Touch</span>
          </h2>
          <p className="contact-lead-subtitle">
            Have a project in mind, an opportunity to discuss, or just want to connect? Let’s start a conversation.
          </p>
        </div>

        <div className="contact-dynamic-grid">
          {/* Left Column: Interactive Contact Hub & Persona Info */}
          <div className="contact-hub-card">
            {/* Live Availability Badge */}
            <div className="availability-status-box">
              <div className="status-indicator-ring">
                <span className="status-live-dot" />
                <span className="status-live-ping" />
              </div>
              <div className="status-text-details">
                <span className="status-headline">Available for Opportunities</span>
                <span className="status-subtext">Open to full-time roles & high-impact projects</span>
              </div>
            </div>

            {/* Response Time & Timezone Clock */}
            <div className="contact-meta-row">
              <div className="meta-info-item">
                <i className="fas fa-clock"></i>
                <div>
                  <span className="meta-label">Response Time</span>
                  <span className="meta-value">&lt; 24 Hours</span>
                </div>
              </div>
              <div className="meta-info-item">
                <i className="fas fa-globe-asia"></i>
                <div>
                  <span className="meta-label">Local Time</span>
                  <span className="meta-value time-ticker">{currentTime || 'India Standard Time'}</span>
                </div>
              </div>
            </div>

            {/* Interactive Direct Communication Channels */}
            <div className="contact-channel-list">
              {/* Email Card */}
              <div className="contact-channel-item">
                <div className="channel-icon-circle">
                  <i className="fas fa-envelope"></i>
                </div>
                <div className="channel-content">
                  <span className="channel-title">Email</span>
                  <a href={`mailto:${personalInfo.email}`} className="channel-link" title="Open mail client">
                    {personalInfo.email}
                  </a>
                </div>
                <button
                  type="button"
                  className="channel-action-btn"
                  onClick={() => copyToClipboard(personalInfo.email, 'email')}
                  aria-label="Copy email address"
                  title="Copy email to clipboard"
                >
                  <i className={`fas ${copiedField === 'email' ? 'fa-check text-green' : 'fa-copy'}`}></i>
                  <span className="action-tooltip">
                    {copiedField === 'email' ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>

              {/* Phone Card */}
              <div className="contact-channel-item">
                <div className="channel-icon-circle phone-circle">
                  <i className="fas fa-phone"></i>
                </div>
                <div className="channel-content">
                  <span className="channel-title">Phone / WhatsApp</span>
                  <a href={`tel:${personalInfo.phone.replace(/\s+/g, '')}`} className="channel-link">
                    {personalInfo.phone}
                  </a>
                </div>
                <button
                  type="button"
                  className="channel-action-btn"
                  onClick={() => copyToClipboard(personalInfo.phone, 'phone')}
                  aria-label="Copy phone number"
                  title="Copy phone to clipboard"
                >
                  <i className={`fas ${copiedField === 'phone' ? 'fa-check text-green' : 'fa-copy'}`}></i>
                  <span className="action-tooltip">
                    {copiedField === 'phone' ? 'Copied!' : 'Copy'}
                  </span>
                </button>
              </div>

              {/* Location Card */}
              <div className="contact-channel-item">
                <div className="channel-icon-circle location-circle">
                  <i className="fas fa-location-dot"></i>
                </div>
                <div className="channel-content">
                  <span className="channel-title">Location</span>
                  <span className="channel-link static-text">
                    {personalInfo.location} <span className="remote-badge">· Remote Worldwide</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Social Connectivity Rail */}
            <div className="contact-social-section">
              <span className="social-rail-title">Connect on Professional & Social Platforms</span>
              <div className="social-icon-rail">
                {socialLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-rail-btn"
                    title={`Connect on ${link.name}`}
                    aria-label={`Visit Sachin's ${link.name} profile`}
                  >
                    <i className={link.iconClass}></i>
                    <span className="social-rail-name">{link.name}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Modern Interactive Smart Form */}
          <div className="contact-form-card">
            {isSubmitted ? (
              <div className="form-success-card" role="status">
                <div className="success-icon-badge">
                  <i className="fas fa-check-circle"></i>
                </div>
                <h3>Message Transmitted!</h3>
                <p className="success-desc">
                  Thank you, <strong>{formData.name}</strong>. Your message regarding <em>"{formData.subject}"</em> has been received. I will review it and get back to you at <strong>{formData.email}</strong> shortly.
                </p>
                <div className="success-actions">
                  <button
                    type="button"
                    className="btn btn-secondary-contact"
                    onClick={resetForm}
                  >
                    <i className="fas fa-rotate-left"></i>
                    <span>Send Another Message</span>
                  </button>
                  <a
                    href={`mailto:${personalInfo.email}`}
                    className="btn btn-outline-contact"
                  >
                    <i className="fas fa-envelope"></i>
                    <span>Direct Mail</span>
                  </a>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="modern-form-wrapper" noValidate>
                {/* Inquiry Type Selector Tabs */}
                <div className="inquiry-selector-wrapper">
                  <label className="field-group-title">
                    <i className="fas fa-bullseye"></i>
                    <span>What can I help you with?</span>
                  </label>
                  <div className="inquiry-button-grid" role="radiogroup" aria-label="Inquiry Type">
                    {inquiryTypes.map((type) => {
                      const isSelected = inquiryType === type.id;
                      return (
                        <button
                          key={type.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`inquiry-pill-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleInquiryChange(type)}
                        >
                          <i className={type.icon}></i>
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Message Starters / Templates */}
                <div className="quick-starters-wrapper">
                  <span className="quick-starters-label">
                    <i className="fas fa-wand-magic-sparkles"></i>
                    <span>Quick starters:</span>
                  </span>
                  <div className="quick-starters-list">
                    {quickStarters.map((starter) => (
                      <button
                        key={starter.label}
                        type="button"
                        className="starter-chip-btn"
                        onClick={() => handleTemplateClick(starter)}
                        title="Click to insert draft starter"
                      >
                        <span>{starter.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error Banner if any */}
                {status.type === 'error' && (
                  <div className="form-alert-banner error" role="alert">
                    <i className="fas fa-circle-exclamation"></i>
                    <span>{status.message}</span>
                  </div>
                )}

                {/* Form Fields Grid */}
                <div className="form-fields-grid">
                  {/* Name Field */}
                  <div className="modern-form-field">
                    <label htmlFor="contact-name">
                      <span>Your Name</span>
                      <span className="req-star">*</span>
                    </label>
                    <div className="input-icon-box">
                      <i className="fas fa-user input-icon"></i>
                      <input
                        type="text"
                        id="contact-name"
                        name="name"
                        placeholder="e.g. Alex Johnson"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  {/* Email Field */}
                  <div className="modern-form-field">
                    <label htmlFor="contact-email">
                      <span>Email Address</span>
                      <span className="req-star">*</span>
                      {formData.email && isValidEmail(formData.email) && (
                        <span className="valid-email-badge">
                          <i className="fas fa-check"></i> Valid
                        </span>
                      )}
                    </label>
                    <div className="input-icon-box">
                      <i className="fas fa-envelope input-icon"></i>
                      <input
                        type="email"
                        id="contact-email"
                        name="email"
                        placeholder="e.g. alex@company.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>
                </div>

                {/* Subject Field */}
                <div className="modern-form-field full-width">
                  <label htmlFor="contact-subject">
                    <span>Subject</span>
                    <span className="req-star">*</span>
                  </label>
                  <div className="input-icon-box">
                    <i className="fas fa-tag input-icon"></i>
                    <input
                      type="text"
                      id="contact-subject"
                      name="subject"
                      placeholder="e.g. Project Inquiry or Role Discussion"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                {/* Message Field */}
                <div className="modern-form-field full-width">
                  <div className="message-label-row">
                    <label htmlFor="contact-message">
                      <span>Your Message</span>
                      <span className="req-star">*</span>
                    </label>
                    <span className="character-counter" aria-live="polite">
                      {wordCount} words · {messageLength} chars
                    </span>
                  </div>
                  <div className="textarea-icon-box">
                    <textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      placeholder={
                        inquiryType === 'job'
                          ? "Tell me about the role, team, tech stack, and what problem we'd be solving together..."
                          : inquiryType === 'freelance'
                          ? "Tell me about your project goals, scope, timeline, and requirements..."
                          : "Share your thoughts or ideas, and let's explore how we can connect..."
                      }
                      value={formData.message}
                      onChange={handleChange}
                      required
                    ></textarea>
                  </div>
                </div>

                {/* Submit Row */}
                <div className="form-submit-row">
                  <button
                    type="submit"
                    className={`btn-modern-submit ${isSubmitting ? 'submitting' : ''}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="submit-spinner" />
                        <span>Transmitting Message...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <i className="fas fa-paper-plane submit-arrow"></i>
                      </>
                    )}
                  </button>

                  <span className="secure-badge">
                    <i className="fas fa-shield-halved"></i>
                    <span>Direct submission · No spam guaranteed</span>
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
