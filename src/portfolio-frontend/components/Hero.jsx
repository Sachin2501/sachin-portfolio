import React, { useState, useEffect } from 'react';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import { personalInfo, rotatingSubtitles, socialLinks } from '../../data/portfolioData.js';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const Hero = () => {
  const { profileConfig } = usePortfolioBackend();
  const [typedName, setTypedName] = useState('');
  const [isTypingName, setIsTypingName] = useState(true);
  const [subtitleText, setSubtitleText] = useState('');
  const [subIndex, setSubIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const liveName = profileConfig?.name || personalInfo.name;
  const liveBioLead = profileConfig?.bioLead || personalInfo.bioLead;
  const activeSubtitles = React.useMemo(() => {
    const customTitle = profileConfig?.title?.trim();
    if (customTitle && !rotatingSubtitles.includes(customTitle)) {
      return [customTitle, ...rotatingSubtitles];
    }
    return rotatingSubtitles;
  }, [profileConfig?.title]);

  // Reset typing animation when liveName changes in database
  useEffect(() => {
    setTypedName('');
    setIsTypingName(true);
  }, [liveName]);

  // 1. Typing animation for liveName in H1
  useEffect(() => {
    const fullName = liveName;
    let timeout;

    if (typedName.length < fullName.length) {
      timeout = setTimeout(() => {
        setTypedName(fullName.slice(0, typedName.length + 1));
      }, 100);
    } else {
      timeout = setTimeout(() => {
        setIsTypingName(false);
      }, 1000);
    }

    return () => clearTimeout(timeout);
  }, [typedName, liveName]);

  // 2. Rotating subtitle typing loop
  useEffect(() => {
    if (isTypingName) return;

    const currentString = activeSubtitles[subIndex % activeSubtitles.length] || rotatingSubtitles[0];
    let timeout;

    if (!isDeleting) {
      if (charIndex < currentString.length) {
        timeout = setTimeout(() => {
          setSubtitleText(currentString.substring(0, charIndex + 1));
          setCharIndex(charIndex + 1);
        }, 100);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, 2000);
      }
    } else {
      if (charIndex > 0) {
        timeout = setTimeout(() => {
          setSubtitleText(currentString.substring(0, charIndex - 1));
          setCharIndex(charIndex - 1);
        }, 50);
      } else {
        timeout = setTimeout(() => {
          setIsDeleting(false);
          setSubIndex((subIndex + 1) % activeSubtitles.length);
          setCharIndex(0);
        }, 300);
      }
    }

    return () => clearTimeout(timeout);
  }, [isTypingName, charIndex, isDeleting, subIndex, activeSubtitles]);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home">
      <SectionTechBackground type="home" />
      <div className="container">
        <div className="hero-content">
          {/* Status Pill Badge */}
          <div className="hero-status-badge">
            <span className="hero-status-pulse">
              <span className="hero-status-dot"></span>
              <span className="hero-status-ping"></span>
            </span>
            <span className="hero-status-text">Available for New Projects & Roles</span>
          </div>

          <h1>
            Hi, I'm{' '}
            <span className={isTypingName ? 'typing-text' : ''}>
              {typedName || liveName}
            </span>
          </h1>

          <h2>
            <span>{subtitleText || profileConfig?.title || ' '}</span>
          </h2>

          <p>{liveBioLead}</p>

          <div>
            <div className="social-links-home">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                >
                  <i className={social.iconClass}></i>
                </a>
              ))}
            </div>

            <div className="hero-btns">
              <button
                type="button"
                className="btn btn-hero-cta-primary"
                onClick={() => scrollToSection('projects')}
              >
                <span>Explore Projects</span>
                <ArrowRight size={17} />
              </button>
              <button
                type="button"
                className="btn btn-outline btn-hero-cta-secondary"
                onClick={() => scrollToSection('contact')}
              >
                <Mail size={16} />
                <span>Get In Touch</span>
              </button>
            </div>
          </div>
        </div>

        <div className="hero-image">
          <img
            src={profileConfig?.heroImage || personalInfo.heroImage}
            alt={liveName}
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;
