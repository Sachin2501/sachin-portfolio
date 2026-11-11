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
                    <div key={edu.id} className="experience-card-item">
                      <div className="experience-card-top">
                        <div className="experience-card-header">
                          <h3>{edu.degree}</h3>
                          <div className="experience-company-row">
                            <i className="fas fa-university" style={{ color: '#10b981' }}></i>
                            <span className="issuer">{edu.institute}</span>
                          </div>
                        </div>
                        <span className="date">{edu.duration}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', margin: '0.8rem 0', flexWrap: 'wrap' }}>
                        <span className="grade" style={{ background: 'rgba(16, 185, 129, 0.12)', padding: '0.25rem 0.75rem', borderRadius: '15px' }}>
                          <i className="fas fa-award" style={{ marginRight: '5px' }}></i>
                          {edu.grade}
                        </span>
                        {edu.status && (
                          <span
                            style={{
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: '#3b82f6',
                              background: 'rgba(59, 130, 246, 0.12)',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '15px',
                            }}
                          >
                            <i className="fas fa-circle-check" style={{ marginRight: '5px' }}></i>
                            {edu.status}
                          </span>
                        )}
                      </div>

                      {edu.highlights && (
                        <ul className="experience-details" style={{ margin: '1rem 0', paddingLeft: '1.2rem' }}>
                          {edu.highlights.map((h, i) => (
                            <li key={i} style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                              {h}
                            </li>
                          ))}
                        </ul>
                      )}

                      {edu.skills && (
                        <div className="tech-used" style={{ marginTop: 'auto', marginBottom: '0.8rem' }}>
                          {edu.skills.map((skill) => (
                            <span key={skill} className="tech-tag">
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="experience-card-action" style={{ paddingTop: '0.8rem', borderTop: '1px solid var(--border-color)' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: '#10b981',
                            fontWeight: 600,
                            fontSize: '0.88rem',
                          }}
                        >
                          <i className="fas fa-certificate"></i> Verified Degree Program
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
