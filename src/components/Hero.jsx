import React, { useState, useEffect } from 'react';
import { personalInfo, rotatingSubtitles, socialLinks } from '../data/portfolioData.js';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const Hero = () => {
  const { profileConfig } = usePortfolioBackend();
  const [typedName, setTypedName] = useState('');
  const [isTypingName, setIsTypingName] = useState(true);
  const [subtitleText, setSubtitleText] = useState('');
  const [subIndex, setSubIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Typing animation for "Sachin Kumar" in H1
  useEffect(() => {
    const fullName = personalInfo.name;
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
  }, [typedName]);

  // 2. Rotating subtitle typing loop
  useEffect(() => {
    if (isTypingName) return;

    const currentString = rotatingSubtitles[subIndex];
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
          setSubIndex((subIndex + 1) % rotatingSubtitles.length);
          setCharIndex(0);
        }, 300);
      }
    }

    return () => clearTimeout(timeout);
  }, [isTypingName, charIndex, isDeleting, subIndex]);

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
          <h1>
            Hi, I'm{' '}
            <span className={isTypingName ? 'typing-text' : ''}>
              {typedName}
            </span>
          </h1>

          <h2>
            <span>{subtitleText || ' '}</span>
          </h2>

          <p>{personalInfo.bioLead}</p>

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
                className="btn"
                onClick={() => scrollToSection('projects')}
              >
                View My Work
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => scrollToSection('contact')}
              >
                Get In Touch
              </button>
            </div>
          </div>
        </div>

        <div className="hero-image">
          <img
            src={profileConfig?.heroImage || personalInfo.heroImage}
            alt={personalInfo.name}
          />
        </div>
      </div>
    </section>
  );
};
