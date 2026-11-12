import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const Education = () => {
  const { educationList: dynamicEduList } = usePortfolioBackend();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const groups = [
    { key: 'engineering', label: 'Engineering & Technology' },
    { key: 'sciences', label: 'Mathematical Sciences' },
  ];

  const filterTabs = [
    { key: 'all', label: `All (${dynamicEduList.length})` },
    { key: 'engineering', label: 'Engineering' },
    { key: 'sciences', label: 'Sciences' },
  ];

  const filteredGroups =
    selectedFilter === 'all'
      ? groups
      : groups.filter((g) => g.key === selectedFilter);

  return (
    <section id="education">
      <SectionTechBackground type="education" />
      <div className="container">
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <GraduationCap className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">Education</span>
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
            const groupEdu = dynamicEduList.filter(
              (edu) => edu.category === group.key
            );
            if (groupEdu.length === 0) return null;

            return (
              <div key={group.key} className="cert-group-section">
                <div className="group-label">
                  <i
                    className={`fas ${group.key === 'engineering' ? 'fa-graduation-cap' : 'fa-calculator'}`}
                    style={{ marginRight: '8px' }}
                  ></i>
                  {group.label}
                </div>

                <div className="experience-card-grid">
                  {groupEdu.map((edu) => (
                    <div key={edu.id} className="experience-card-item education-card-item">
                      <div className="experience-card-top">
                        <div className="experience-card-header">
                          <h3>{edu.degree}</h3>
                          <div className="experience-company-row">
                            <i className="fas fa-university edu-univ-icon"></i>
                            <span className="issuer">{edu.institute}</span>
                          </div>
                        </div>
                        <span className="date">{edu.duration}</span>
                      </div>

                      {(edu.grade || edu.status) && (
                        <div className="edu-meta-badges">
                          {edu.grade && (
                            <span className="grade edu-grade-badge">
                              <i className="fas fa-award"></i>
                              <span>{edu.grade}</span>
                            </span>
                          )}
                          {edu.status && (
                            <span className="edu-status-badge">
                              <i className="fas fa-circle-check"></i>
                              <span>{edu.status}</span>
                            </span>
                          )}
                        </div>
                      )}

                      {edu.highlights && (
                        <ul className="experience-details">
                          {edu.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      )}

                      {edu.skills && (
                        <div className="tech-used edu-tech-used">
                          {edu.skills.map((skill) => (
                            <span key={skill} className="tech-tag">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="experience-card-action edu-card-footer">
                        <div className="edu-verified-badge">
                          <i className="fas fa-certificate"></i>
                          <span>Verified Degree Program</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
