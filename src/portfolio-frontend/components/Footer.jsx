import React from 'react';
import { personalInfo, socialLinks } from '../../data/portfolioData.js';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const Footer = () => {
  const { profileConfig } = usePortfolioBackend();
  const currentYear = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="container">
        <div className="footer-main-compact">
          {/* 1. Name Section */}
          <div className="footer-name-section">
            <div
              className="footer-brand-logo"
              onClick={scrollToTop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') scrollToTop();
              }}
              title="Scroll to Top"
            >
              <div className="footer-monogram">
                <img
                  src={profileConfig?.logoImage || personalInfo.logoImage || '/assets/aistudio/Gemini_Generated_Image_hizeznhizeznhize_739e79f3.png'}
                  alt={`${personalInfo.name} SK Logo`}
                  className="footer-logo-badge-img"
                  loading="lazy"
                />
              </div>
              <div className="footer-brand-titles">
                <span className="footer-brand-name">{personalInfo.name}</span>
                <span className="footer-brand-role">{personalInfo.title}</span>
              </div>
            </div>
            <p className="footer-short-tagline">
              Full-Stack Developer & AI Enthusiast • Building high-performance web experiences
            </p>
          </div>

          {/* 2. Follow and Connect Section */}
          <div className="footer-follow-connect">
            <span className="footer-connect-title">Follow & Connect</span>
            <div className="footer-social-icons">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-social-btn"
                  aria-label={social.name}
                  title={social.name}
                >
                  <i className={social.iconClass}></i>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Small Section */}
        <div className="footer-small-section">
          <p className="footer-copyright">
            &copy; {currentYear} {personalInfo.name}. All rights reserved.
          </p>
          <button
            type="button"
            className="footer-scroll-top-btn"
            onClick={scrollToTop}
            aria-label="Back to Top of Page"
            title="Back to Top"
          >
            <span>Back to top</span>
            <i className="fas fa-arrow-up"></i>
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
