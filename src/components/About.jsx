import React from 'react';
import { User, Eye } from 'lucide-react';
import { personalInfo } from '../data/portfolioData.js';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const About = ({ onOpenResume }) => {
  const { profileConfig } = usePortfolioBackend();
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
            {personalInfo.about.map((paragraph, index) => (
              <h4 key={index}>{paragraph}</h4>
            ))}
            <div className="about-cta-container">
              <button
                type="button"
                onClick={onOpenResume}
                className="btn view-resume-btn"
                title="View Resume Document (PDF)"
                aria-label="View Resume Document in interactive preview modal"
              >
                <Eye className="view-resume-icon" size={19} strokeWidth={2.2} />
                <span className="view-resume-text">View Resume</span>
                <span className="view-resume-badge">PDF</span>
              </button>
            </div>
          </div>

          <div className="about-image">
            <img
              src={profileConfig?.aboutImage || personalInfo.aboutImage}
              alt={personalInfo.name}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
