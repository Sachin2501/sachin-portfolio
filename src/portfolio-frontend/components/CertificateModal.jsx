import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  PdfCanvasViewer,
  base64ToUint8Array,
  preloadPdfDocument,
  renderPdfFirstPageToPng,
} from './PdfCanvasViewer.jsx';

// Global in-memory image preload & decoded element cache for 0ms instant certificate display
const PRELOADED_CERT_IMAGES = new Set();
const PRELOADED_IMAGE_OBJECTS = new Map();
const PDF_GENERATED_PREVIEW_CACHE = new Map();

const normalizeImageUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.includes('%')) {
    return trimmed;
  }
  return encodeURI(trimmed);
};

export const isCertificateImagePreloaded = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const normalized = normalizeImageUrl(rawUrl);
  return PRELOADED_CERT_IMAGES.has(rawUrl) || PRELOADED_CERT_IMAGES.has(normalized);
};

export const preloadCertificateImage = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return Promise.resolve(false);
  const normalized = normalizeImageUrl(rawUrl);
  if (!normalized || isPdfSource(normalized)) return Promise.resolve(false);

  if (PRELOADED_CERT_IMAGES.has(normalized)) {
    return Promise.resolve(true);
  }

  if (PRELOADED_IMAGE_OBJECTS.has(normalized)) {
    return PRELOADED_IMAGE_OBJECTS.get(normalized).promise;
  }

  let resolvePromise;
  const promise = new Promise((resolve) => {
    resolvePromise = resolve;
  });

  const img = new Image();
  img.decoding = 'async';

  const markReady = () => {
    PRELOADED_CERT_IMAGES.add(rawUrl);
    PRELOADED_CERT_IMAGES.add(normalized);
    resolvePromise(true);
  };

  img.onload = () => {
    if (typeof img.decode === 'function') {
      img.decode().then(markReady).catch(markReady);
    } else {
      markReady();
    }
  };

  img.onerror = () => {
    PRELOADED_IMAGE_OBJECTS.delete(normalized);
    resolvePromise(false);
  };

  PRELOADED_IMAGE_OBJECTS.set(normalized, { img, promise });
  img.src = normalized;

  if (img.complete && img.naturalWidth > 0) {
    markReady();
  }

  return promise;
};

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

const derivePreviewFromPdfPath = (pdfPath) => {
  if (typeof pdfPath !== 'string' || !pdfPath) return '';
  const trimmed = pdfPath.trim();
  if (
    trimmed.startsWith('/certificates/') &&
    !trimmed.startsWith('/certificates/previews/') &&
    trimmed.toLowerCase().endsWith('.pdf')
  ) {
    const baseName = trimmed.replace(/^\/certificates\//, '').replace(/\.pdf$/i, '');
    if (baseName) {
      return `/certificates/previews/${baseName}.png`;
    }
  }
  return '';
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

  const explicitImageCandidate =
    !isPdfSource(rawPreview) && rawPreview
      ? rawPreview
      : !isPdfSource(certificate?.image) && certificate?.image
      ? certificate.image
      : !isPdfSource(rawFile) && rawFile
      ? rawFile
      : '';

  const derivedImageCandidate =
    !explicitImageCandidate && pdfCandidate ? derivePreviewFromPdfPath(pdfCandidate) : '';

  const [generatedPdfPreview, setGeneratedPdfPreview] = useState(() =>
    pdfCandidate ? PDF_GENERATED_PREVIEW_CACHE.get(pdfCandidate) || '' : ''
  );

  const imageCandidate =
    explicitImageCandidate || derivedImageCandidate || generatedPdfPreview || '';
  const activeImageUrl = normalizeImageUrl(imageCandidate || (!hasPdfSource ? rawFile : ''));

  const [isZoomed, setIsZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(() =>
    Boolean(activeImageUrl && isCertificateImagePreloaded(activeImageUrl))
  );
  const [imageError, setImageError] = useState(false);
  const [preferPdfView, setPreferPdfView] = useState(false);

  // Sync modal state when certificate changes; keep imageLoaded=true if already preloaded
  useEffect(() => {
    setIsZoomed(false);
    setImageError(false);

    const cachedGen = pdfCandidate ? PDF_GENERATED_PREVIEW_CACHE.get(pdfCandidate) || '' : '';
    setGeneratedPdfPreview(cachedGen);

    const nextImg = normalizeImageUrl(
      explicitImageCandidate || derivedImageCandidate || cachedGen || (!hasPdfSource ? rawFile : '')
    );
    const alreadyReady = Boolean(nextImg && isCertificateImagePreloaded(nextImg));
    setImageLoaded(alreadyReady);

    if (nextImg && !alreadyReady) {
      preloadCertificateImage(nextImg).then((ok) => {
        if (ok) setImageLoaded(true);
      });
    }

    if (hasPdfSource && pdfCandidate) {
      if (!nextImg && pdfCandidate.startsWith('data:application/pdf')) {
        renderPdfFirstPageToPng(pdfCandidate)
          .then((dataUrl) => {
            if (dataUrl) {
              PDF_GENERATED_PREVIEW_CACHE.set(pdfCandidate, dataUrl);
              PRELOADED_CERT_IMAGES.add(dataUrl);
              setGeneratedPdfPreview(dataUrl);
              setImageLoaded(true);
              setPreferPdfView(false);
            }
          })
          .catch(() => {});
      }
    }

    if (hasPdfSource && !nextImg) {
      setPreferPdfView(true);
    } else {
      setPreferPdfView(false);
    }
  }, [
    certificate,
    hasPdfSource,
    explicitImageCandidate,
    derivedImageCandidate,
    pdfCandidate,
    rawFile,
  ]);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleImgRef = useCallback(
    (imgEl) => {
      if (imgEl) {
        imgEl.setAttribute('fetchpriority', 'high');
        if (imgEl.complete && imgEl.naturalWidth > 0) {
          if (activeImageUrl) {
            PRELOADED_CERT_IMAGES.add(activeImageUrl);
          }
          setImageLoaded(true);
        }
      }
    },
    [activeImageUrl]
  );

  // Convert Base64 PDF data URL to a Blob URL for clean file download
  const downloadBlobUrl = useMemo(() => {
    const target = hasPdfSource ? pdfCandidate : imageCandidate || rawFile;
    if (!target) return '';
    if (target.startsWith('data:')) {
      return dataUrlToBlobUrl(target) || target;
    }
    return normalizeImageUrl(target);
  }, [hasPdfSource, pdfCandidate, imageCandidate, rawFile]);

  const getDownloadExtension = useCallback(
    (urlStr) => {
      const clean = String(urlStr || '').split('?')[0].toLowerCase();
      if (clean.endsWith('.pdf') || clean.startsWith('data:application/pdf')) return '.pdf';
      if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return '.jpg';
      if (clean.endsWith('.svg')) return '.svg';
      if (clean.endsWith('.png')) return '.png';
      return hasPdfSource ? '.pdf' : '.png';
    },
    [hasPdfSource]
  );

  const downloadFileName = useMemo(() => {
    const target = hasPdfSource ? pdfCandidate : imageCandidate || rawFile;
    const ext = getDownloadExtension(target);
    const safeBase = (certificate?.title || 'certificate')
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return `${safeBase || 'certificate'}${ext}`;
  }, [certificate?.title, hasPdfSource, pdfCandidate, imageCandidate, rawFile, getDownloadExtension]);

  const handleDownloadCertificate = useCallback(
    async (e) => {
      if (!downloadBlobUrl) return;
      // If it's already a client-side blob: or data: URL, trigger native download directly
      if (downloadBlobUrl.startsWith('blob:') || downloadBlobUrl.startsWith('data:')) {
        return;
      }

      e.preventDefault();
      if (isDownloading) return;
      setIsDownloading(true);

      const triggerBlobSave = (blob, filename) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      };

      try {
        let response = await fetch(downloadBlobUrl);
        let finalFilename = downloadFileName;

        // If the PDF file isn't found or returns HTML fallback, fall back to the preview image
        const contentType = response.headers.get('content-type') || '';
        if (
          (!response.ok || contentType.includes('text/html')) &&
          activeImageUrl &&
          activeImageUrl !== downloadBlobUrl
        ) {
          response = await fetch(activeImageUrl);
          const safeBase = (certificate?.title || 'certificate')
            .replace(/[^a-z0-9]+/gi, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase();
          finalFilename = `${safeBase || 'certificate'}${getDownloadExtension(activeImageUrl)}`;
        }

        if (response.ok) {
          const blob = await response.blob();
          triggerBlobSave(blob, finalFilename);
          return;
        }
      } catch {
        // Fallback below
      } finally {
        setIsDownloading(false);
      }

      // Direct server attachment download fallback
      const sep = downloadBlobUrl.includes('?') ? '&' : '?';
      const fallbackLink = document.createElement('a');
      fallbackLink.href = `${downloadBlobUrl}${sep}download=1&filename=${encodeURIComponent(downloadFileName)}`;
      fallbackLink.download = downloadFileName;
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      fallbackLink.remove();
    },
    [
      downloadBlobUrl,
      downloadFileName,
      activeImageUrl,
      certificate?.title,
      getDownloadExtension,
      isDownloading,
    ]
  );

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
          <div
            className="cert-modal-title-wrap"
            style={{ overflow: 'hidden', paddingRight: '0.25rem', flex: '1 1 200px', minWidth: 0 }}
          >
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
          <div
            className="cert-modal-header-actions"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}
          >
            {hasPdfSource && imageCandidate && (
              <button
                type="button"
                className="cert-modal-switch-btn"
                onMouseEnter={() => {
                  if (pdfCandidate) {
                    preloadPdfDocument(pdfCandidate).catch(() => {});
                  }
                }}
                onClick={() => {
                  setImageError(false);
                  if (!showAsPdf && pdfCandidate) {
                    preloadPdfDocument(pdfCandidate).catch(() => {});
                  }
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
              previewImage={
                imageCandidate && imageCandidate !== pdfCandidate ? activeImageUrl : null
              }
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
                    pointerEvents: 'none',
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
                  <PdfCanvasViewer
                    src={pdfCandidate}
                    previewImage={
                      imageCandidate && imageCandidate !== pdfCandidate ? activeImageUrl : null
                    }
                    title={certificate.title}
                  />
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
                  ref={handleImgRef}
                  src={activeImageUrl}
                  alt={certificate.title}
                  loading="eager"
                  decoding="async"
                  onLoad={() => {
                    if (activeImageUrl) {
                      PRELOADED_CERT_IMAGES.add(activeImageUrl);
                    }
                    setImageLoaded(true);
                  }}
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
                    transition: 'opacity 0.12s ease, transform 0.2s ease, width 0.2s ease',
                    opacity: imageLoaded ? 1 : 0,
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
              download={downloadFileName}
              onClick={handleDownloadCertificate}
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
                opacity: isDownloading ? 0.8 : 1,
              }}
            >
              <i className={`fas ${isDownloading ? 'fa-spinner fa-spin' : 'fa-download'}`}></i>
              {isDownloading
                ? 'Downloading...'
                : `Download ${hasPdfSource ? 'PDF' : 'Certificate'}`}
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
