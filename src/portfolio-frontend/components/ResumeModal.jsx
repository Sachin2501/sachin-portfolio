import React, { useEffect, useState } from 'react';
import { PdfCanvasViewer } from './PdfCanvasViewer.jsx';
import { usePortfolioBackend } from '../../context/PortfolioBackendContext.jsx';

export const ResumeModal = ({ isOpen, onClose }) => {
  const { profileConfig } = usePortfolioBackend();
  const [zoom, setZoom] = useState(1.0);
  const [viewMode, setViewMode] = useState('pdf'); // Default to 'pdf' so all resume pages are visible
  const [imgError, setImgError] = useState(false);

  const customResumeUrl = profileConfig?.resumeUrl;
  const resumePdfPath =
    customResumeUrl &&
    (customResumeUrl.toLowerCase().endsWith('.pdf') ||
      customResumeUrl.startsWith('data:application/pdf'))
      ? customResumeUrl
      : '/certificates/resume.pdf';

  const resumePreviewPath =
    customResumeUrl &&
    !customResumeUrl.toLowerCase().endsWith('.pdf') &&
    !customResumeUrl.startsWith('data:application/pdf') &&
    customResumeUrl !== '/sachin_kumar_cv.pdf'
      ? customResumeUrl
      : '/certificates/previews/resume.png';

  const [downloadHref, setDownloadHref] = useState(resumePdfPath);

  useEffect(() => {
    let createdBlobUrl = null;
    if (resumePdfPath && resumePdfPath.startsWith('data:application/pdf')) {
      try {
        const parts = resumePdfPath.split(',');
        const base64 = parts.length > 1 ? parts[1] : parts[0];
        const raw = window.atob(base64);
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          bytes[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        createdBlobUrl = URL.createObjectURL(blob);
        setDownloadHref(createdBlobUrl);
      } catch {
        setDownloadHref(resumePdfPath);
      }
    } else {
      setDownloadHref(resumePdfPath);
    }
    return () => {
      if (createdBlobUrl) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [resumePdfPath]);

  useEffect(() => {
    if (!isOpen) return;
    setZoom(1.0);
    setImgError(false);
    // Open directly in full interactive multi-page PDF Viewer unless a custom image URL was set
    if (
      customResumeUrl &&
      !customResumeUrl.toLowerCase().endsWith('.pdf') &&
      !customResumeUrl.startsWith('data:application/pdf') &&
      customResumeUrl !== '/sachin_kumar_cv.pdf' &&
      customResumeUrl !== '/certificates/resume.pdf'
    ) {
      setViewMode('image');
    } else {
      setViewMode('pdf');
    }
  }, [isOpen, customResumeUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(2.2, +(z + 0.2).toFixed(2)));
  const handleZoomOut = () => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)));
  const handleResetZoom = () => setZoom(1.0);

  return (
    <div
      className="modal-overlay active"
      onClick={(e) => {
        if (e.target.classList.contains('modal-overlay')) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Resume Preview"
      style={{
        padding: '0.75rem',
        zIndex: 9999,
      }}
    >
      <div
        className="modal-container"
        style={{
          maxWidth: '1000px',
          width: '96%',
          height: '92vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '12px 18px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i
              className="fas fa-file-pdf"
              style={{ color: '#ff6b6b', fontSize: '1.25rem' }}
            ></i>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              Sachin Kumar — Official Resume
            </h3>
          </div>

          <div
            className="resume-modal-header-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            {/* View Mode Toggle: Interactive PDF Viewer vs HD Image Preview */}
            <div
              style={{
                display: 'inline-flex',
                background: 'rgba(15, 23, 42, 0.12)',
                borderRadius: '999px',
                padding: '3px',
                border: '1px solid rgba(148, 163, 184, 0.28)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                style={{
                  padding: '5px 13px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background:
                    viewMode === 'pdf'
                      ? 'linear-gradient(45deg, #ff6b6b, #ee5a24)'
                      : 'transparent',
                  color: viewMode === 'pdf' ? '#ffffff' : 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                <i className="fas fa-file-pdf" style={{ marginRight: '5px' }}></i>
                Full PDF View
              </button>
              <button
                type="button"
                onClick={() => setViewMode('image')}
                style={{
                  padding: '5px 13px',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background:
                    viewMode === 'image'
                      ? 'linear-gradient(45deg, #ff6b6b, #ee5a24)'
                      : 'transparent',
                  color: viewMode === 'image' ? '#ffffff' : 'inherit',
                  transition: 'all 0.2s ease',
                }}
              >
                <i className="fas fa-image" style={{ marginRight: '5px' }}></i>
                HD Image
              </button>
            </div>

            {viewMode === 'image' && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(15, 23, 42, 0.08)',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                }}
              >
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    color: 'inherit',
                    fontWeight: 700,
                  }}
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset Zoom"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: 'inherit',
                  }}
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom In"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 6px',
                    color: 'inherit',
                    fontWeight: 700,
                  }}
                >
                  +
                </button>
              </div>
            )}

            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close Resume Modal"
              style={{ marginLeft: '4px' }}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>

        {/* Modal Body: Top-aligned so top of resume is never clipped */}
        <div
          className="modal-body"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: viewMode === 'image' && !imgError ? 'auto' : 'hidden',
            overflowX: viewMode === 'image' && !imgError ? 'auto' : 'hidden',
            padding: viewMode === 'image' && !imgError ? '20px 16px' : '0',
            background: '#0b1120',
            display: 'flex',
            flexDirection: 'column',
            alignItems: viewMode === 'image' && !imgError ? 'center' : 'stretch',
            justifyContent: 'flex-start',
          }}
        >
          {viewMode === 'image' && !imgError ? (
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
              }}
            >
              <img
                src={resumePreviewPath}
                alt="Sachin Kumar Resume Preview"
                onError={() => {
                  setImgError(true);
                  setViewMode('pdf');
                }}
                style={{
                  width: `${Math.round(zoom * 100)}%`,
                  maxWidth: zoom === 1 ? '840px' : 'none',
                  height: 'auto',
                  borderRadius: '8px',
                  boxShadow: '0 14px 40px rgba(0, 0, 0, 0.5)',
                  background: '#ffffff',
                  display: 'block',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <PdfCanvasViewer
                src={resumePdfPath}
                url={resumePdfPath}
                title="Sachin Kumar — Official Resume"
                onError={() => {
                  if (!imgError) {
                    setViewMode('image');
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer resume-modal-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '12px 20px',
            flexShrink: 0,
          }}
        >
          <span className="resume-footer-verified" style={{ fontSize: '0.84rem', opacity: 0.85 }}>
            <i
              className="fas fa-check-circle"
              style={{ color: '#10b981', marginRight: '6px' }}
            ></i>
            Verified Curriculum Vitae • Sachin Kumar
          </span>

          <div className="resume-footer-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={downloadHref}
              download="Sachin_Kumar_Resume.pdf"
              className="btn resume-footer-btn"
              style={{
                padding: '9px 22px',
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: '50px',
              }}
            >
              <i className="fas fa-download"></i> Download Resume PDF
            </a>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline resume-footer-btn"
              style={{
                padding: '9px 20px',
                fontSize: '0.9rem',
                background: 'rgba(148, 163, 184, 0.15)',
                color: 'inherit',
                border: '1px solid rgba(148, 163, 184, 0.35)',
                borderRadius: '50px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeModal;
