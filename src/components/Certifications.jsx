import React, { useState } from 'react';
import { Award } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { usePortfolioBackend } from '../context/PortfolioBackendContext.jsx';

export const Certifications = ({ onSelectCertificate }) => {
  const { certificationsList } = usePortfolioBackend();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const groups = [
    { key: 'web', label: 'Web Development Certifications' },
    { key: 'ai', label: 'Artificial Intelligence Certifications' },
    { key: 'isro', label: 'ISRO Certifications' },
    { key: 'other', label: 'Other Course Certifications' },
    { key: 'internship', label: 'Internship Certifications' },
  ];

  const filterTabs = [
    { key: 'all', label: `All (${certificationsList.length})` },
    { key: 'web', label: 'Web Dev' },
    { key: 'ai', label: 'AI & ML' },
    { key: 'isro', label: 'ISRO' },
    { key: 'internship', label: 'Internships' },
    { key: 'other', label: 'Other' },
  ];

  const filteredGroups = selectedFilter === 'all'
    ? groups
    : groups.filter((g) => g.key === selectedFilter);

  return (
    <section id="certifications">
      <SectionTechBackground type="certifications" />
      <div className="container">
        <div className="section-header-center">
          <h2 className="section-title">
            <span className="section-title-icon-badge" aria-hidden="true">
              <Award className="section-title-icon" size={24} strokeWidth={2.2} />
            </span>
            <span className="section-title-text">Certifications</span>
          </h2>
        </div>

        {/* Filter Bar */}
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
            const groupCerts = certificationsList.filter(
              (c) => c.category === group.key
            );
            if (groupCerts.length === 0) return null;

            return (
              <div key={group.key} className="cert-group-section">
                <div className="group-label">{group.label}</div>
                <div className="certification-group">
                  {groupCerts.map((cert) => (
                    <div key={cert.id} className="certification-item">
                      <div className="certification-content">
                        <h3>{cert.title}</h3>
                        <p className="issuer">{cert.issuer}</p>
                        <span className="date">{cert.date}</span>
                      </div>

                      <button
                        type="button"
                        className="certificate-view"
                        onClick={() => onSelectCertificate(cert)}
                        title={`View ${cert.title}`}
                      >
                        <i className="fas fa-certificate"></i> View Certificate
                      </button>
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
