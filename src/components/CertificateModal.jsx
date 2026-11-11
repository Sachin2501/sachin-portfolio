import React, { useEffect, useState } from 'react';

export const CertificateModal = ({ certificate, onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setIsZoomed(false);
    setImageLoaded(false);
    setImageError(false);
  }, [certificate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (certificate) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [certificate, onClose]);

  if (!certificate) return null;

  // Use pre-rendered high-res image preview (or native image for jpg/png)
  const displayImage = certificate.preview || certificate.file;
  const originalFile = certificate.file;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-container" style={{ maxWidth: '950px', height: '90vh' }}>
        <div className="modal-header">
          <div style={{ overflow: 'hidden', paddingRight: '1rem' }}>
            <h3 title={certificate.title}>{certificate.title}</h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>{certificate.issuer}</span> • <span>{certificate.date}</span>
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {!imageError && (
              <button
                type="button"
                className="modal-zoom-btn"
                onClick={() => setIsZoomed(!isZoomed)}
                title={isZoomed ? 'Fit to window' : 'Zoom in to full resolution'}
                style={{
                  background: 'var(--tag-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'inherit',
                }}
              >
                <i className={`fas ${isZoomed ? 'fa-magnifying-glass-minus' : 'fa-magnifying-glass-plus'}`}></i>
                <span>{isZoomed ? 'Fit' : 'Zoom'}</span>
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close certificate preview"
            >
              ✕
            </button>
          </div>
        </div>

        <div
          className="modal-body"
          style={{
            position: 'relative',
            overflow: 'auto',
            display: 'flex',
            alignItems: isZoomed ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: '1.2rem',
            background: 'var(--bg-secondary)',
          }}
        >
          {!imageLoaded && !imageError && (
            <div
              style={{
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.8rem',
                color: 'var(--text-secondary)',
              }}
            >
              <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
              <span style={{ fontSize: '0.9rem' }}>Loading verified certificate...</span>
            </div>
          )}

          {imageError ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '2.5rem',
                background: 'var(--bg-card)',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                maxWidth: '520px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(59, 130, 246, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                  color: '#3b82f6',
                  fontSize: '1.8rem',
                }}
              >
                <i className="fas fa-certificate"></i>
              </div>
              <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                {certificate.title}
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                Issued by <strong>{certificate.issuer}</strong> ({certificate.date})
              </p>
              <a
                href={encodeURI(originalFile)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <i className="fas fa-external-link-alt"></i>
                <span>Open Document Directly</span>
              </a>
            </div>
          ) : (
            <img
              src={displayImage}
              alt={certificate.title}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              style={{
                maxWidth: isZoomed ? 'none' : '100%',
                maxHeight: isZoomed ? 'none' : '100%',
                width: isZoomed ? '1200px' : 'auto',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-color)',
                transition: 'transform 0.2s ease, width 0.2s ease',
                display: imageLoaded ? 'block' : 'none',
                cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                margin: 'auto',
              }}
              onClick={() => setIsZoomed(!isZoomed)}
            />
          )}
        </div>

        <div className="modal-footer" style={{ gap: '0.8rem', flexWrap: 'wrap' }}>
          <a
            href={encodeURI(originalFile)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{
              color: '#3b82f6',
              borderColor: '#3b82f6',
              padding: '8px 18px',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <i className="fas fa-external-link-alt"></i>
            Open Full Document
          </a>

          <a
            href={encodeURI(originalFile)}
            download
            className="btn"
            style={{
              padding: '8px 20px',
              fontSize: '0.9rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <i className="fas fa-download"></i>
            Download Certificate
          </a>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline"
            style={{
              padding: '8px 16px',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              borderColor: 'var(--border-color)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
