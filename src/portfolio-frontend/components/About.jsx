import React from 'react';
import { User } from 'lucide-react';
import { personalInfo } from '../../data/portfolioData.js';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const About = ({ onOpenResume }) => {
  const { profileConfig } = usePortfolioBackend();
  const aboutParagraphs = React.useMemo(() => {
    if (Array.isArray(profileConfig?.about) && profileConfig.about.length > 0) {
      return profileConfig.about;
    }
    if (typeof profileConfig?.about === 'string' && profileConfig.about.trim()) {
      return profileConfig.about.split('\n').filter(Boolean);
    }
    const base = [...(personalInfo.about || [])];
    if (
      profileConfig?.bioLead &&
      profileConfig.bioLead.trim() &&
      profileConfig.bioLead.trim() !== personalInfo.bioLead.trim()
    ) {
      base[0] = profileConfig.bioLead.trim();
    }
    return base;
  }, [profileConfig?.about, profileConfig?.bioLead]);

  return (
    <section id="about">
      <SectionTechBackground type="about" />
      <div className="container">
        <div className="about-content">
          <div className="about-text">
            <h2 className="section-title section-title-left">
              <span className="section-title-icon-badge" aria-hidden="true">
                <User className="section-title-icon" size={24} strokeWidth={2.2} />
              </span>
              <span className="section-title-text">About Me</span>
            </h2>
            {aboutParagraphs.map((paragraph, index) => (
              <h4 key={index}>{paragraph}</h4>
            ))}
            <div className="about-cta-container">
              <button
                type="button"
                onClick={onOpenResume}
                className="btn view-resume-btn"
                title="View Full Interactive Resume (PDF)"
                aria-label="View Resume"
              >
                <span className="resume-btn-icon-box" aria-hidden="true">
                  <i className="fas fa-file-pdf"></i>
                </span>
                <span className="resume-btn-content">
                  <span className="resume-btn-label">View Resume</span>
                  <span className="resume-btn-sub">Official CV • PDF Preview</span>
                </span>
                <span className="resume-btn-arrow" aria-hidden="true">
                  <i className="fas fa-arrow-up-right-from-square"></i>
                </span>
              </button>
            </div>
          </div>

          <div className="about-image">
            <img
              src={profileConfig?.aboutImage || personalInfo.aboutImage}
              alt={profileConfig?.name || personalInfo.name}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
