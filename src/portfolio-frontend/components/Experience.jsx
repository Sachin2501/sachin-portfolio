import React, { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const Experience = ({ onSelectCertificate }) => {
  const { experienceList } = usePortfolioBackend();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const groups = [
    { key: 'ai', label: 'AI & Machine Learning Internships' },
    { key: 'web', label: 'Web & Full Stack Internships' },
  ];

  const filterTabs = [
    { key: 'all', label: `All (${experienceList.length})` },
    { key: 'ai', label: 'AI & ML' },
    { key: 'web', label: 'Web & Full Stack' },
  ];

  const filteredGroups =
    selectedFilter === 'all'
      ? groups
      : groups.filter((g) => g.key === selectedFilter);

  return (
    <section id="experience">
      <SectionTechBackground type="experience" />
      <div className="container">
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <Briefcase className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">Work Experience &amp; Internships</span>
          </h2>
        </div>

        {/* Category Filter Tabs */}
        <div className="cert-filter-bar">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`cert-filter-btn ${selectedFilter === tab.key ? 'active' : ''}`}
              onClick={() => setSelectedFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="certifications-container">
          {filteredGroups.map((group) => {
            const groupExp = (experienceList || []).filter((e) => {
              const cat = String(e.category || 'web').toLowerCase();
              if (group.key === 'ai') return cat === 'ai';
              return cat !== 'ai';
            });
            if (groupExp.length === 0) return null;

            return (
              <div key={group.key} className="cert-group-section">
                <div className="group-label">
                  <i
                    className={`fas ${group.key === 'ai' ? 'fa-brain' : 'fa-laptop-code'}`}
                    style={{ marginRight: '8px' }}
                  ></i>
                  {group.label}
                </div>

                <div className="experience-card-grid">
                  {groupExp.map((exp) => {
                    const detailsList = Array.isArray(exp.details) && exp.details.length > 0
                      ? exp.details
                      : Array.isArray(exp.description) && exp.description.length > 0
                      ? exp.description
                      : typeof exp.description === 'string' && exp.description.trim()
                      ? exp.description.split('\n').filter(Boolean)
                      : [];

                    const techList = Array.isArray(exp.tech) && exp.tech.length > 0
                      ? exp.tech
                      : Array.isArray(exp.skills) && exp.skills.length > 0
                      ? exp.skills
                      : typeof exp.skills === 'string' && exp.skills.trim()
                      ? exp.skills.split(',').map((s) => s.trim()).filter(Boolean)
                      : [];

                    return (
                      <div key={exp.id || exp._id} className="experience-card-item">
                        <div className="experience-card-top">
                          <div className="experience-card-header">
                            <h3>{exp.role || exp.title}</h3>
                            <div className="experience-company-row">
                              <i className="fas fa-building" style={{ color: '#3b82f6' }}></i>
                              <span className="issuer">{exp.company}</span>
                            </div>
                          </div>
                          <span className="date">{exp.duration || exp.period}</span>
                        </div>

                        {detailsList.length > 0 && (
                          <ul className="experience-details" style={{ margin: '1rem 0', paddingLeft: '1.2rem' }}>
                            {detailsList.map((detail, idx) => (
                              <li key={idx} style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                                {detail}
                              </li>
                            ))}
                          </ul>
                        )}

                        {techList.length > 0 && (
                          <div className="tech-used" style={{ marginTop: 'auto', marginBottom: '1.2rem' }}>
                            {techList.map((tag) => (
                              <span key={tag} className="tech-tag">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {exp.certificate && onSelectCertificate && (
                          <div className="experience-card-action" style={{ paddingTop: '0.8rem', borderTop: '1px solid var(--border-color)' }}>
                            <button
                              type="button"
                              className="certificate-view"
                              onClick={() => onSelectCertificate(exp.certificate)}
                              title={`View certificate for ${exp.role || exp.title}`}
                            >
                              <i className="fas fa-certificate"></i> View Certificate
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
