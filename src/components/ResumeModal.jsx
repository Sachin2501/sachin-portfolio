import React, { useEffect, useState, useRef, useCallback } from 'react';

export const ResumeModal = ({ isOpen, onClose }) => {
  const [viewMode, setViewMode] = useState('pdf'); // 'pdf' (canvas renderer) or 'preview' (high-res image)
  const [scale, setScale] = useState(1.15); // Zoom scale for PDF canvas
  const [isPdfLoading, setIsPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  const canvasRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const containerRef = useRef(null);

  const resumePdfPath = '/certificates/resume.pdf';
  const resumePreviewPath = '/certificates/previews/resume.png';

  // Body scroll lock & Escape key listener
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsImageZoomed(false);
      setImageLoaded(false);
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Load PDF document using PDF.js
  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;
    setIsPdfLoading(true);
    setPdfError(null);

    const initPdf = async () => {
      try {
        // Ensure PDF.js is loaded
        let pdfjs = window.pdfjsLib;

        if (!pdfjs) {
          // Dynamic script fallback if not already in window
          await new Promise((resolve, reject) => {
            const existingScript = document.querySelector('script[src*="pdf.min.js"]');
            if (existingScript) {
              existingScript.addEventListener('load', resolve);
              existingScript.addEventListener('error', reject);
              return;
            }
            const script = document.createElement('script');
            script.src = '/vendor/pdfjs/pdf.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          pdfjs = window.pdfjsLib;
        }

        if (!pdfjs) {
          throw new Error('PDF.js library could not be initialized.');
        }

        // Configure worker
        pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';

        // Load document
        const loadingTask = pdfjs.getDocument({
          url: resumePdfPath,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setIsPdfLoading(false);
      } catch (err) {
        if (isCancelled) return;
        console.warn('PDF.js loading issue, falling back to image preview:', err);
        setPdfError(err.message || 'Failed to load PDF');
        setIsPdfLoading(false);
        // Seamless fallback to high-resolution preview image
        setViewMode('preview');
      }
    };

    initPdf();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore cancel error
        }
      }
    };
  }, [isOpen]);

  // Render current PDF page to canvas
  const renderPdfPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current || viewMode !== 'pdf') return;

    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore previous task cancel
        }
      }

      const page = await pdfDocRef.current.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 2; // Crisp rendering on Retina / 4K

      const viewport = page.getViewport({ scale });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
      context.scale(dpr, dpr);

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      const task = page.render(renderContext);
      renderTaskRef.current = task;
      await task.promise;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('PDF render error:', err);
      }
    }
  }, [currentPage, scale, viewMode]);

  useEffect(() => {
    if (viewMode === 'pdf' && !isPdfLoading && pdfDocRef.current) {
      renderPdfPage();
    }
  }, [viewMode, isPdfLoading, scale, currentPage, renderPdfPage]);

  // Zoom helpers
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2.4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.6));
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      // Standard 8.5" width at 72 DPI is 612px
      const targetScale = Math.min(Math.max(containerWidth / 612, 0.7), 1.6);
      setScale(parseFloat(targetScale.toFixed(2)));
    } else {
      setScale(1.15);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-modal-title"
    >
      <div
        className="modal-container"
        style={{
          maxWidth: '1020px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
        }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ overflow: 'hidden', paddingRight: '1rem' }}>
            <h3 id="resume-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <i className="fas fa-file-lines" style={{ color: '#3b82f6', fontSize: '1.2rem' }}></i>
              <span>Sachin Kumar — Curriculum Vitae</span>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="fas fa-check-circle" style={{ fontSize: '0.68rem' }}></i> Verified Document
              </span>
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span>Software Engineer & AI/ML Developer</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
            {/* View Mode Toggle: PDF Canvas vs High-Res Image Preview */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--tag-bg)',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid var(--border-color)',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('pdf')}
                style={{
                  background: viewMode === 'pdf' ? '#3b82f6' : 'transparent',
                  color: viewMode === 'pdf' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="View interactive rendered PDF document"
              >
                <i className="fas fa-file-pdf"></i>
                <span>PDF Document</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                style={{
                  background: viewMode === 'preview' ? '#3b82f6' : 'transparent',
                  color: viewMode === 'preview' ? '#ffffff' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
                title="View high-resolution certificate image preview"
              >
                <i className="fas fa-image"></i>
                <span>Certificate View</span>
              </button>
            </div>

            {/* Controls for PDF Canvas Mode */}
            {viewMode === 'pdf' && !isPdfLoading && !pdfError && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  background: 'var(--tag-bg)',
                  borderRadius: '8px',
                  padding: '2px 4px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  aria-label="Zoom out"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  <i className="fas fa-minus"></i>
                </button>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, minWidth: '42px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  {Math.round(scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom In"
                  aria-label="Zoom in"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  <i className="fas fa-plus"></i>
                </button>
                <button
                  type="button"
                  onClick={handleFitWidth}
                  title="Fit to Width"
                  aria-label="Fit to width"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  Fit
                </button>
              </div>
            )}

            {/* Controls for High-Res Image Preview Mode */}
            {viewMode === 'preview' && (
              <button
                type="button"
                className="modal-zoom-btn"
                onClick={() => setIsImageZoomed(!isImageZoomed)}
                title={isImageZoomed ? 'Fit to window' : 'Zoom in to full resolution'}
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
                <i className={`fas ${isImageZoomed ? 'fa-magnifying-glass-minus' : 'fa-magnifying-glass-plus'}`}></i>
                <span>{isImageZoomed ? 'Fit' : 'Zoom'}</span>
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close resume viewer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div
          ref={containerRef}
          className="modal-body"
          style={{
            position: 'relative',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: (viewMode === 'preview' && !isImageZoomed) ? 'center' : 'flex-start',
            padding: '1.5rem',
            background: 'var(--bg-secondary)',
            flexGrow: 1,
            minHeight: '420px',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* PDF Canvas View */}
          {viewMode === 'pdf' && (
            <>
              {isPdfLoading && (
                <div
                  style={{
                    margin: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.9rem',
                    color: 'var(--text-secondary)',
                    padding: '3rem',
                  }}
                >
                  <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2.4rem', color: '#3b82f6' }}></i>
                  <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>Rendering verified PDF document...</span>
                </div>
              )}

              {pdfError ? (
                <div
                  style={{
                    margin: 'auto',
                    textAlign: 'center',
                    padding: '2.5rem',
                    background: 'var(--bg-card)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    maxWidth: '480px',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <i className="fas fa-file-pdf" style={{ fontSize: '2.8rem', color: '#ef4444', marginBottom: '1rem' }}></i>
                  <h4 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                    Direct PDF Rendering Not Available
                  </h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Your browser or iframe preview environment blocked embedded canvas rendering. You can switch to high-res preview or open the document directly.
                  </p>
                  <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('preview')}
                      className="btn"
                      style={{ fontSize: '0.88rem', padding: '8px 16px' }}
                    >
                      <i className="fas fa-image" style={{ marginRight: '6px' }}></i> View High-Res Preview
                    </button>
                    <a
                      href={encodeURI(resumePdfPath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline"
                      style={{ fontSize: '0.88rem', padding: '8px 16px' }}
                    >
                      <i className="fas fa-external-link-alt" style={{ marginRight: '6px' }}></i> Open PDF in Tab
                    </a>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    display: isPdfLoading ? 'none' : 'flex',
                    justifyContent: 'center',
                    width: '100%',
                    paddingBottom: '1.5rem',
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{
                      display: 'block',
                      margin: '0 auto',
                      borderRadius: '8px',
                      boxShadow: '0 14px 40px rgba(0, 0, 0, 0.28)',
                      border: '1px solid var(--border-color)',
                      background: '#ffffff',
                      transition: 'box-shadow 0.2s ease',
                    }}
                  />
                </div>
              )}
            </>
          )}

          {/* High-Res Image Preview Mode */}
          {viewMode === 'preview' && (
            <>
              {!imageLoaded && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.8rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3b82f6' }}></i>
                  <span style={{ fontSize: '0.9rem' }}>Loading resume preview...</span>
                </div>
              )}

              <img
                src={resumePreviewPath}
                alt="Sachin Kumar Resume"
                onLoad={() => setImageLoaded(true)}
                style={{
                  maxWidth: isImageZoomed ? 'none' : '100%',
                  maxHeight: isImageZoomed ? 'none' : '100%',
                  width: isImageZoomed ? '1120px' : 'auto',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 14px 40px rgba(0, 0, 0, 0.28)',
                  border: '1px solid var(--border-color)',
                  transition: 'transform 0.2s ease, width 0.2s ease',
                  display: imageLoaded ? 'block' : 'none',
                  cursor: isImageZoomed ? 'zoom-out' : 'zoom-in',
                  margin: 'auto',
                  background: '#ffffff',
                }}
                onClick={() => setIsImageZoomed(!isImageZoomed)}
              />
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ gap: '0.8rem', flexWrap: 'wrap', padding: '1rem 1.6rem' }}>
          <a
            href={encodeURI(resumePdfPath)}
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
            href={encodeURI(resumePdfPath)}
            download="Sachin_Kumar_Resume.pdf"
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
            Download Resume
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

export default ResumeModal;
