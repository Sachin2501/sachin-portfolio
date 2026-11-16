import React, { useState, useEffect, useCallback } from 'react';
import { Award } from 'lucide-react';
import { SectionTechBackground } from './SectionTechBackground.jsx';
import { preloadPdfDocument } from './PdfCanvasViewer.jsx';
import { preloadCertificateImage } from './CertificateModal.jsx';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const Certifications = ({ onSelectCertificate }) => {
  const { certificationsList } = usePortfolioBackend();
  const [selectedFilter, setSelectedFilter] = useState('all');

  const warmCertAssets = useCallback((cert, includePdf = false) => {
    if (!cert) return;
    const imgUrl = cert.preview || cert.image || cert.file;
    if (imgUrl && !String(imgUrl).toLowerCase().includes('.pdf')) {
      preloadCertificateImage(imgUrl).catch(() => {});
    } else if (
      cert.file &&
      String(cert.file).startsWith('/certificates/') &&
      String(cert.file).toLowerCase().endsWith('.pdf')
    ) {
      const base = String(cert.file).replace(/^\/certificates\//, '').replace(/\.pdf$/i, '');
      if (base) {
        preloadCertificateImage(`/certificates/previews/${base}.png`).catch(() => {});
      }
    }
    if (includePdf && cert.file && String(cert.file).toLowerCase().includes('.pdf')) {
      preloadPdfDocument(cert.file).catch(() => {});
    }
  }, []);

  // Preload all certificate preview images in the background so opening any certificate is instant (0ms)
  useEffect(() => {
    if (!Array.isArray(certificationsList) || certificationsList.length === 0) return undefined;
    const timers = certificationsList.map((cert, idx) =>
      setTimeout(() => {
        warmCertAssets(cert, false);
      }, idx * 45)
    );
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [certificationsList, warmCertAssets]);

  const knownKeys = ['web', 'ai', 'isro', 'internship', 'other'];

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
            const normalizeCertCategory = (rawCat) => {
              const cat = String(rawCat || 'web').toLowerCase().trim();
              if (cat === 'web' || cat.includes('web') || cat.includes('front') || cat.includes('full')) return 'web';
              if (cat === 'ai' || cat.includes('ai') || cat.includes('ml') || cat.includes('machine') || cat.includes('artificial')) return 'ai';
              if (cat === 'isro' || cat.includes('isro') || cat.includes('space')) return 'isro';
              if (cat === 'internship' || cat.includes('intern')) return 'internship';
              if (knownKeys.includes(cat)) return cat;
              return 'other';
            };
            const groupCerts = certificationsList.filter((c) => {
              return normalizeCertCategory(c.category) === group.key;
            });
            if (groupCerts.length === 0) return null;

            return (
              <div key={group.key} className="cert-group-section">
                <div className="group-label">{group.label}</div>
                <div className="certification-group">
                  {groupCerts.map((cert) => (
                    <div key={cert.id || cert._id} className="certification-item">
                      <div className="certification-content">
                        <h3>{cert.title}</h3>
                        <p className="issuer">{cert.issuer}</p>
                        <span className="date">{cert.date}</span>
                      </div>

                      <button
                        type="button"
                        className="certificate-view"
                        onMouseEnter={() => warmCertAssets(cert, true)}
                        onFocus={() => warmCertAssets(cert, true)}
                        onTouchStart={() => warmCertAssets(cert, true)}
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
