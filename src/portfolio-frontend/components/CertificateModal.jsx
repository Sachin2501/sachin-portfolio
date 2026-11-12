import React, { useEffect, useState, useMemo } from 'react';
import { PdfCanvasViewer, base64ToUint8Array } from './PdfCanvasViewer.jsx';

const isPdfSource = (val) => {
  if (typeof val !== 'string' || !val) return false;
  const trimmed = val.trim().toLowerCase();
  return (
    trimmed.startsWith('data:application/pdf') ||
    trimmed.endsWith('.pdf') ||
    trimmed.includes('.pdf?') ||
    trimmed.includes('application/pdf')
  );
};

const dataUrlToBlobUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return null;
  }
  try {
    const meta = dataUrl.split(',')[0] || '';
    const mimeMatch = meta.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bytes = base64ToUint8Array(dataUrl);
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to convert base64 PDF to Blob URL:', err);
    return null;
  }
};

export const CertificateModal = ({ certificate, onClose }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [preferPdfView, setPreferPdfView] = useState(false);

  // Determine available sources
  const rawFile = certificate?.file || certificate?.link || '';
  const rawPreview = certificate?.preview || certificate?.image || '';

  const hasPdfSource =
    isPdfSource(rawFile) || isPdfSource(rawPreview) || isPdfSource(certificate?.image);
  const pdfCandidate = isPdfSource(rawFile)
    ? rawFile
    : isPdfSource(rawPreview)
    ? rawPreview
    : isPdfSource(certificate?.image)
    ? certificate.image
    : '';

  const imageCandidate =
    !isPdfSource(rawPreview) && rawPreview
      ? rawPreview
      : !isPdfSource(certificate?.image) && certificate?.image
      ? certificate.image
      : !isPdfSource(rawFile) && rawFile
      ? rawFile
      : '';

  // Automatically prefer PDF Canvas view if there is no separate image preview or if the uploaded file is a Base64 PDF
  useEffect(() => {
    setIsZoomed(false);
    setImageLoaded(false);
    setImageError(false);
    if (
      hasPdfSource &&
      (!imageCandidate ||
        pdfCandidate.startsWith('data:application/pdf') ||
        imageCandidate === pdfCandidate ||
        imageCandidate === '/certificates/previews/ibm-web-dev.png')
    ) {
      setPreferPdfView(true);
    } else {
      setPreferPdfView(false);
    }
  }, [certificate, hasPdfSource, imageCandidate, pdfCandidate]);

  // Convert Base64 PDF data URL to a Blob URL for clean file download
  const downloadBlobUrl = useMemo(() => {
    const target = hasPdfSource ? pdfCandidate : imageCandidate || rawFile;
    if (!target) return '';
    if (target.startsWith('data:')) {
      return dataUrlToBlobUrl(target) || target;
    }
    return encodeURI(target);
  }, [hasPdfSource, pdfCandidate, imageCandidate, rawFile]);

  useEffect(() => {
    return () => {
      if (downloadBlobUrl && downloadBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadBlobUrl);
      }
    };
  }, [downloadBlobUrl]);

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

  const showAsPdf = (preferPdfView && hasPdfSource) || (!imageCandidate && hasPdfSource);
  const activeImageUrl = imageCandidate || rawFile;
  const externalVerifyLink =
    certificate.link &&
    typeof certificate.link === 'string' &&
    certificate.link.startsWith('http')
      ? certificate.link
      : null;

  return (
    <div
      className="modal-overlay cert-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(2, 6, 23, 0.86)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-container cert-modal-container"
        style={{
          width: '100%',
          maxWidth: '960px',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #0f172a)',
          color: 'var(--text-primary, #f8fafc)',
          border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
        }}
      >
        <div
          className="modal-header cert-modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, rgba(148, 163, 184, 0.15))',
            background: 'var(--bg-secondary, #0b1120)',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div className="cert-modal-title-wrap" style={{ overflow: 'hidden', paddingRight: '0.25rem', flex: '1 1 200px', minWidth: 0 }}>
            <h3
              title={certificate.title}
              style={{
                margin: 0,
                fontSize: 'clamp(0.92rem, 2.5vw, 1.05rem)',
                fontWeight: 700,
                color: 'var(--text-primary, #f8fafc)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {certificate.title}
            </h3>
            <p
              style={{
                margin: '0.18rem 0 0 0',
                fontSize: '0.78rem',
                color: 'var(--text-secondary, #94a3b8)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <span>{certificate.issuer}</span>
              {certificate.date ? ` • ${certificate.date}` : ''}
            </p>
          </div>
          <div className="cert-modal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            {hasPdfSource && imageCandidate && (
              <button
                type="button"
                className="cert-modal-switch-btn"
                onClick={() => {
                  setImageError(false);
                  setPreferPdfView(!showAsPdf);
                }}
                style={{
                  background: showAsPdf
                    ? 'rgba(6, 182, 212, 0.18)'
                    : 'var(--tag-bg, rgba(30, 41, 59, 0.9))',
                  border: showAsPdf
                    ? '1px solid rgba(6, 182, 212, 0.45)'
                    : '1px solid var(--border-color, rgba(148, 163, 184, 0.25))',
                  borderRadius: '8px',
                  padding: '6px 11px',
                  color: showAsPdf ? '#22d3ee' : 'var(--text-primary, #f8fafc)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'inherit',
                }}
              >
                <i className={`fas ${showAsPdf ? 'fa-image' : 'fa-file-pdf'}`}></i>
                <span>{showAsPdf ? 'Image Preview' : 'PDF View'}</span>
              </button>
            )}

            {!showAsPdf && !imageError && (
              <button
                type="button"
                className="modal-zoom-btn"
                onClick={() => setIsZoomed(!isZoomed)}
                title={isZoomed ? 'Fit to window' : 'Zoom in to full resolution'}
                style={{
                  background: 'var(--tag-bg, rgba(30, 41, 59, 0.9))',
                  border: '1px solid var(--border-color, rgba(148, 163, 184, 0.25))',
                  borderRadius: '8px',
                  padding: '6px 11px',
                  color: 'var(--text-primary, #f8fafc)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontFamily: 'inherit',
                }}
              >
                <i
                  className={`fas ${
                    isZoomed ? 'fa-magnifying-glass-minus' : 'fa-magnifying-glass-plus'
                  }`}
                ></i>
                <span>{isZoomed ? 'Fit' : 'Zoom'}</span>
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close certificate preview"
              style={{
                background: 'rgba(239, 68, 68, 0.14)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        <div
          className="modal-body cert-modal-body"
          style={{
            position: 'relative',
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: showAsPdf ? 'stretch' : isZoomed ? 'flex-start' : 'center',
            justifyContent: 'center',
            padding: showAsPdf ? '0' : 'clamp(0.6rem, 2vw, 1.2rem)',
            background: 'var(--bg-secondary, #0b1120)',
          }}
        >
          {showAsPdf && pdfCandidate ? (
            <PdfCanvasViewer
              src={pdfCandidate}
              title={certificate.title}
              onError={() => {
                if (imageCandidate && imageCandidate !== pdfCandidate) {
                  setPreferPdfView(false);
                }
              }}
            />
          ) : (
            <>
              {!imageLoaded && !imageError && (
                <div
                  style={{
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.8rem',
                    color: 'var(--text-secondary, #94a3b8)',
                  }}
                >
                  <i
                    className="fas fa-circle-notch fa-spin"
                    style={{ fontSize: '2rem', color: '#3b82f6' }}
                  ></i>
                  <span style={{ fontSize: '0.9rem' }}>Loading verified certificate...</span>
                </div>
              )}

              {imageError ? (
                hasPdfSource ? (
                  <PdfCanvasViewer src={pdfCandidate} title={certificate.title} />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      padding: 'clamp(1.25rem, 4vw, 2.5rem)',
                      background: 'var(--bg-card, #1e293b)',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color, rgba(148, 163, 184, 0.25))',
                      maxWidth: '520px',
                      width: '100%',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
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
                    <h4
                      style={{
                        fontSize: '1.15rem',
                        marginBottom: '0.5rem',
                        color: 'var(--text-primary, #f8fafc)',
                      }}
                    >
                      {certificate.title}
                    </h4>
                    <p
                      style={{
                        color: 'var(--text-secondary, #94a3b8)',
                        fontSize: '0.9rem',
                        marginBottom: '1.5rem',
                      }}
                    >
                      Issued by <strong>{certificate.issuer}</strong> ({certificate.date})
                    </p>
                  </div>
                )
              ) : (
                <img
                  src={activeImageUrl}
                  alt={certificate.title}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    if (hasPdfSource) {
                      setPreferPdfView(true);
                    } else {
                      setImageError(true);
                    }
                  }}
                  style={{
                    maxWidth: isZoomed ? 'none' : '100%',
                    maxHeight: isZoomed ? 'none' : '100%',
                    width: isZoomed ? 'min(1200px, 220vw)' : 'auto',
                    objectFit: 'contain',
                    borderRadius: '8px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border-color, rgba(148, 163, 184, 0.2))',
                    transition: 'transform 0.2s ease, width 0.2s ease',
                    display: imageLoaded ? 'block' : 'none',
                    cursor: isZoomed ? 'zoom-out' : 'zoom-in',
                    margin: 'auto',
                  }}
                  onClick={() => setIsZoomed(!isZoomed)}
                />
              )}
            </>
          )}
        </div>

        <div
          className="modal-footer cert-modal-footer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            flexWrap: 'wrap',
            borderTop: '1px solid var(--border-color, rgba(148, 163, 184, 0.15))',
            background: 'var(--bg-secondary, #0b1120)',
          }}
        >
          {externalVerifyLink && (
            <a
              href={externalVerifyLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline cert-footer-btn"
              style={{
                color: '#38bdf8',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '0.86rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <i className="fas fa-external-link-alt"></i>
              Verify Credential URL
            </a>
          )}

          {downloadBlobUrl && (
            <a
              href={downloadBlobUrl}
              download={`${(certificate.title || 'certificate')
                .replace(/[^a-z0-9]/gi, '_')
                .toLowerCase()}${hasPdfSource ? '.pdf' : '.png'}`}
              className="btn cert-footer-btn"
              style={{
                background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '8px 18px',
                fontSize: '0.86rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
            >
              <i className="fas fa-download"></i>
              Download {hasPdfSource ? 'PDF' : 'Certificate'}
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline cert-footer-btn"
            style={{
              padding: '8px 16px',
              fontSize: '0.86rem',
              fontWeight: 600,
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--text-secondary, #94a3b8)',
              border: '1px solid var(--border-color, rgba(148, 163, 184, 0.25))',
              cursor: 'pointer',
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
  );
};
