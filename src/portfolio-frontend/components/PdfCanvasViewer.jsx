import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure local worker matching the exact pdfjs version used by react-pdf
const detectedVersion = pdfjs?.version || '6.3.289';
pdfjs.GlobalWorkerOptions.workerSrc =
  detectedVersion === '6.5.438'
    ? '/pdf.worker.6.5.438.min.mjs'
    : '/pdf.worker.6.3.289.min.mjs';

// Global in-memory binary & page snapshot caches for instant 0ms re-renders
const PDF_BINARY_CACHE = new Map();
const PDF_FETCH_PROMISES = new Map();
const PDF_PAGE_SNAPSHOT_CACHE = new Map();

/**
 * Convert a base64 data URL or raw base64 string into a Uint8Array
 */
export const base64ToUint8Array = (dataUrl) => {
  const parts = dataUrl.split(',');
  const base64 = parts.length > 1 ? parts.slice(1).join(',') : parts[0];
  const cleanBase64 = base64.replace(/\s/g, '');
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * Validate %PDF- header and return trimmed Uint8Array
 */
const normalizePdfBytes = (rawBytes) => {
  if (!rawBytes || !rawBytes.length) {
    throw new Error('Empty PDF document buffer.');
  }
  const headerWindow = Math.min(rawBytes.length, 1024);
  let pdfHeaderOffset = -1;
  for (let i = 0; i <= headerWindow - 5; i++) {
    if (
      rawBytes[i] === 0x25 && // %
      rawBytes[i + 1] === 0x50 && // P
      rawBytes[i + 2] === 0x44 && // D
      rawBytes[i + 3] === 0x46 && // F
      rawBytes[i + 4] === 0x2d // -
    ) {
      pdfHeaderOffset = i;
      break;
    }
  }
  if (pdfHeaderOffset === -1) {
    throw new Error('The selected document is not a valid PDF file.');
  }
  return pdfHeaderOffset > 0 ? rawBytes.slice(pdfHeaderOffset) : rawBytes;
};

/**
 * Asynchronously fetch and cache PDF bytes so opening a modal is instant
 */
export const preloadPdfDocument = async (pdfSource) => {
  if (!pdfSource || typeof pdfSource !== 'string') return null;
  const cacheKey = pdfSource.startsWith('data:')
    ? `data:${pdfSource.length}:${pdfSource.slice(0, 64)}`
    : pdfSource.trim();

  if (PDF_BINARY_CACHE.has(cacheKey)) {
    return PDF_BINARY_CACHE.get(cacheKey);
  }

  if (PDF_FETCH_PROMISES.has(cacheKey)) {
    return PDF_FETCH_PROMISES.get(cacheKey);
  }

  const promise = (async () => {
    try {
      let bytes;
      if (pdfSource.startsWith('data:')) {
        bytes = normalizePdfBytes(base64ToUint8Array(pdfSource));
      } else {
        const resolvedUrl =
          !pdfSource.startsWith('blob:') && !pdfSource.includes('%')
            ? encodeURI(pdfSource)
            : pdfSource;
        const response = await fetch(resolvedUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while loading PDF`);
        }
        const arrayBuffer = await response.arrayBuffer();
        bytes = normalizePdfBytes(new Uint8Array(arrayBuffer));
      }
      PDF_BINARY_CACHE.set(cacheKey, bytes);
      return bytes;
    } finally {
      PDF_FETCH_PROMISES.delete(cacheKey);
    }
  })();

  PDF_FETCH_PROMISES.set(cacheKey, promise);
  return promise;
};

/**
 * Render the first page of a PDF to a high-res JPEG data URL (used by Admin uploader)
 */
export const renderPdfFirstPageToPng = async (pdfSource) => {
  try {
    const bytes = await preloadPdfDocument(pdfSource);
    if (!bytes) return null;
    const loadingTask = pdfjs.getDocument({ data: bytes.slice(0), verbosity: 0 });
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    pdfDoc.destroy();
    return dataUrl;
  } catch (err) {
    console.warn('Could not pre-render PDF page 1:', err);
    return null;
  }
};

/**
 * Error boundary to guarantee react-pdf can never unmount the React tree
 */
class PdfErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('React-PDF boundary caught error, switching to direct PDF.js canvas:', error);
    if (typeof this.props.onBoundaryError === 'function') {
      this.props.onBoundaryError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

/**
 * Direct PDF.js canvas fallback renderer in case react-pdf fails in any environment
 */
const DirectPdfJsCanvasPage = ({ pdfDoc, pageNumber, totalPages, effectiveWidth, cacheKey }) => {
  const canvasRef = useRef(null);
  const [rendered, setRendered] = useState(false);
  const snapshotKey = `${cacheKey}::page_${pageNumber}`;

  useEffect(() => {
    let active = true;
    let renderTask = null;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!active || !canvasRef.current) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.65);
        const cssScale = effectiveWidth / (baseViewport.width || 600);
        const cssViewport = page.getViewport({ scale: cssScale });
        const renderViewport = page.getViewport({ scale: cssScale * dpr });

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);
        canvas.style.width = `${Math.floor(cssViewport.width)}px`;
        canvas.style.height = `${Math.floor(cssViewport.height)}px`;

        renderTask = page.render({
          canvasContext: ctx,
          viewport: renderViewport,
        });
        await renderTask.promise;
        if (active) {
          setRendered(true);
          try {
            const snap = canvas.toDataURL('image/jpeg', 0.85);
            if (snap && snap.startsWith('data:image/')) {
              PDF_PAGE_SNAPSHOT_CACHE.set(snapshotKey, snap);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`PDF page ${pageNumber} render warning:`, err);
        }
      }
    };

    renderPage();

    return () => {
      active = false;
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, effectiveWidth, snapshotKey]);

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: totalPages > 1 ? '1.35rem' : '0.4rem',
        flexShrink: 0,
      }}
    >
      {totalPages > 1 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '0.45rem',
            padding: '3px 12px',
            borderRadius: '999px',
            background: 'rgba(30, 41, 59, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            color: '#94a3b8',
            fontSize: '0.74rem',
            fontWeight: 600,
          }}
        >
          <span>
            Page {pageNumber} of {totalPages}
          </span>
        </div>
      )}
      <div
        style={{
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          background: '#ffffff',
          margin: '0 auto',
          minHeight: rendered ? 'auto' : '360px',
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', background: '#ffffff' }} />
      </div>
    </div>
  );
};

const DirectPdfJsFallback = ({ pdfBytes, cacheKey, effectiveWidth, onLoaded, onError }) => {
  const [pdfDoc, setPdfDoc] = useState(null);

  useEffect(() => {
    let active = true;
    let loadingTask = null;

    if (!pdfBytes) return undefined;

    try {
      loadingTask = pdfjs.getDocument({ data: pdfBytes.slice(0), verbosity: 0 });
      loadingTask.promise
        .then((doc) => {
          if (active) {
            setPdfDoc(doc);
            if (typeof onLoaded === 'function') {
              onLoaded(doc.numPages || 1);
            }
          } else {
            doc.destroy();
          }
        })
        .catch((err) => {
          if (active && typeof onError === 'function') {
            onError(err);
          }
        });
    } catch (err) {
      if (active && typeof onError === 'function') {
        onError(err);
      }
    }

    return () => {
      active = false;
      if (loadingTask && typeof loadingTask.destroy === 'function') {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfBytes, onLoaded, onError]);

  if (!pdfDoc) return null;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {Array.from({ length: pdfDoc.numPages || 1 }, (_, idx) => (
        <DirectPdfJsCanvasPage
          key={`${cacheKey}_direct_${idx + 1}`}
          pdfDoc={pdfDoc}
          pageNumber={idx + 1}
          totalPages={pdfDoc.numPages || 1}
          effectiveWidth={effectiveWidth}
          cacheKey={cacheKey}
        />
      ))}
    </div>
  );
};

const ReactPdfPageWrapper = ({
  cacheKey,
  pageNumber,
  totalPages,
  targetWidth,
  scale,
  previewImage,
}) => {
  const snapshotKey = `${cacheKey}::page_${pageNumber}`;
  const [cachedSnapshot, setCachedSnapshot] = useState(
    () => PDF_PAGE_SNAPSHOT_CACHE.get(snapshotKey) || (pageNumber === 1 ? previewImage : null) || null
  );
  const [isRendered, setIsRendered] = useState(false);
  const pageContainerRef = useRef(null);

  const handleRenderSuccess = useCallback(() => {
    setIsRendered(true);
    try {
      const canvasEl = pageContainerRef.current?.querySelector('canvas');
      if (canvasEl && canvasEl.width > 0) {
        const snap = canvasEl.toDataURL('image/jpeg', 0.88);
        if (snap && snap.startsWith('data:image/')) {
          PDF_PAGE_SNAPSHOT_CACHE.set(snapshotKey, snap);
          setCachedSnapshot(snap);
        }
      }
    } catch {
      // ignore canvas tainting on cross-origin URLs
    }
  }, [snapshotKey]);

  const effectiveWidth = Math.max(240, Math.round(targetWidth * scale));
  const dpr = useMemo(
    () => Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.6),
    []
  );

  const pageLoadingFallback = useMemo(
    () =>
      cachedSnapshot ? (
        <img
          src={cachedSnapshot}
          alt={`Page ${pageNumber} preview`}
          style={{
            width: `${effectiveWidth}px`,
            maxWidth: scale <= 1.05 ? '100%' : 'none',
            height: 'auto',
            display: 'block',
            background: '#ffffff',
          }}
        />
      ) : (
        <div
          style={{
            width: `${effectiveWidth}px`,
            minHeight: '420px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#0f172a',
            color: '#94a3b8',
            fontSize: '0.84rem',
          }}
        >
          Loading page {pageNumber}...
        </div>
      ),
    [cachedSnapshot, effectiveWidth, pageNumber, scale]
  );

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: totalPages > 1 ? '1.35rem' : '0.4rem',
        flexShrink: 0,
      }}
    >
      {totalPages > 1 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '0.45rem',
            padding: '3px 12px',
            borderRadius: '999px',
            background: 'rgba(30, 41, 59, 0.88)',
            border: '1px solid rgba(148, 163, 184, 0.22)',
            color: '#94a3b8',
            fontSize: '0.74rem',
            fontWeight: 600,
          }}
        >
          <span>
            Page {pageNumber} of {totalPages}
          </span>
        </div>
      )}

      <div
        ref={pageContainerRef}
        style={{
          position: 'relative',
          width: '100%',
          display: 'flex',
          justifyContent: scale > 1.15 ? 'flex-start' : 'center',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'block',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: '#ffffff',
            margin: '0 auto',
          }}
        >
          {/* Overlay snapshot while canvas paints in background so layout is never display:none */}
          {!isRendered && cachedSnapshot && (
            <img
              src={cachedSnapshot}
              alt={`Page ${pageNumber} preview`}
              style={{
                width: `${effectiveWidth}px`,
                maxWidth: scale <= 1.05 ? '100%' : 'none',
                height: 'auto',
                display: 'block',
                background: '#ffffff',
              }}
            />
          )}

          <div
            style={
              !isRendered && cachedSnapshot
                ? {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                  }
                : {
                    position: 'relative',
                    opacity: 1,
                  }
            }
          >
            <Page
              suspense={false}
              pageNumber={pageNumber}
              width={effectiveWidth}
              devicePixelRatio={dpr}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              onRenderSuccess={handleRenderSuccess}
              loading={pageLoadingFallback}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export const PdfCanvasViewer = ({
  src,
  url,
  previewImage = null,
  title = 'Document Preview',
  compact = false,
  initialScale = 1.0,
  onError,
}) => {
  const pdfSource = src || url;
  const cacheKey = useMemo(() => {
    if (!pdfSource || typeof pdfSource !== 'string') return 'empty';
    return pdfSource.startsWith('data:')
      ? `data:${pdfSource.length}:${pdfSource.slice(0, 64)}`
      : pdfSource.trim();
  }, [pdfSource]);

  const [pdfBytes, setPdfBytes] = useState(() => PDF_BINARY_CACHE.get(cacheKey) || null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(compact ? 0.95 : initialScale);
  const [fitWidth, setFitWidth] = useState(true);
  const [loading, setLoading] = useState(() => !PDF_BINARY_CACHE.has(cacheKey));
  const [errorMsg, setErrorMsg] = useState(null);
  const [useDirectFallback, setUseDirectFallback] = useState(false);

  const viewportRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return Math.min(820, Math.max(300, window.innerWidth - 56));
    }
    return 780;
  });

  // Measure container width with debounce to prevent ResizeObserver re-render thrashing
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;

    let timer = null;
    const measure = () => {
      const w = el.clientWidth;
      if (w && w > 180) {
        const target = Math.min(860, w - 28);
        setContainerWidth((prev) => (Math.abs(prev - target) > 16 ? target : prev));
      }
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(measure, 120);
      });
      observer.observe(el);
      return () => {
        if (timer) clearTimeout(timer);
        observer.disconnect();
      };
    }

    const onResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(measure, 120);
    };
    window.addEventListener('resize', onResize);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Load or retrieve cached PDF binary asynchronously
  useEffect(() => {
    let isCancelled = false;
    if (!pdfSource) return undefined;

    setNumPages(0);
    const existing = PDF_BINARY_CACHE.get(cacheKey);
    if (existing) {
      setPdfBytes(existing);
      setLoading(false);
      setErrorMsg(null);
      return undefined;
    }

    setLoading(true);
    setErrorMsg(null);

    preloadPdfDocument(pdfSource)
      .then((bytes) => {
        if (!isCancelled && bytes) {
          setPdfBytes(bytes);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setErrorMsg(err?.message || 'Unable to load PDF document.');
          setLoading(false);
          if (typeof onError === 'function') {
            onError(err);
          }
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [pdfSource, cacheKey, onError]);

  // Provide a fresh copy of the Uint8Array to react-pdf so worker transfer never detaches our cached buffer
  const documentFile = useMemo(() => {
    if (!pdfBytes) return null;
    return { data: pdfBytes.slice(0) };
  }, [pdfBytes]);

  const documentOptions = useMemo(
    () => ({
      verbosity: 0,
    }),
    []
  );

  const handleDocumentLoadSuccess = useCallback((pdf) => {
    setNumPages(pdf?.numPages || 1);
    setLoading(false);
  }, []);

  const handleDocumentLoadError = useCallback(() => {
    // Switch seamlessly to direct PDF.js canvas fallback if react-pdf Document fails
    setUseDirectFallback(true);
    setLoading(false);
  }, []);

  const handleDirectLoaded = useCallback((loadedCount) => {
    setNumPages(loadedCount || 1);
    setLoading(false);
  }, []);

  const handleDirectError = useCallback(
    (err) => {
      setErrorMsg(err?.message || 'Unable to render PDF document.');
      setLoading(false);
      if (typeof onError === 'function') {
        onError(err);
      }
    },
    [onError]
  );

  const fallbackSnapshot =
    PDF_PAGE_SNAPSHOT_CACHE.get(`${cacheKey}::page_1`) || previewImage || null;

  const baseTargetWidth = fitWidth ? containerWidth : 780;
  const effectiveWidth = Math.max(240, Math.round(baseTargetWidth * scale));

  const documentLoadingNode = useMemo(
    () =>
      fallbackSnapshot ? (
        <img
          src={fallbackSnapshot}
          alt={title}
          style={{
            width: `${effectiveWidth}px`,
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '8px',
            background: '#ffffff',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            display: 'block',
            margin: '0 auto',
          }}
        />
      ) : (
        <div
          style={{
            margin: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '2.5rem',
            color: '#94a3b8',
          }}
        >
          <i
            className="fas fa-circle-notch fa-spin"
            style={{ fontSize: '1.8rem', color: '#38bdf8' }}
          ></i>
          <span style={{ fontSize: '0.88rem' }}>Rendering PDF pages...</span>
        </div>
      ),
    [fallbackSnapshot, title, effectiveWidth]
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: compact ? '300px' : '460px',
        display: 'flex',
        flexDirection: 'column',
        background: '#0b1120',
        borderRadius: compact ? '10px' : '0px',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {/* Top PDF Control Toolbar */}
      <div
        className="pdf-viewer-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: compact ? '0.45rem 0.7rem' : '0.55rem 0.9rem',
          background: 'rgba(15, 23, 42, 0.96)',
          borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
          gap: '0.45rem',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.78rem',
            color: '#cbd5e1',
            fontWeight: 600,
            minWidth: 0,
            flex: '1 1 160px',
          }}
        >
          <span
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '0.68rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            PDF
          </span>
          <span
            style={{
              maxWidth: 'clamp(110px, 38vw, 260px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          {numPages > 0 && (
            <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
              · {numPages} {numPages === 1 ? 'Page' : 'Pages'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => {
              setFitWidth(false);
              setScale((s) => Math.max(0.55, Number((s - 0.15).toFixed(2))));
            }}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#e2e8f0',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Zoom Out"
          >
            −
          </button>
          <span
            style={{
              fontSize: '0.74rem',
              color: '#e2e8f0',
              minWidth: '42px',
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 600,
            }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              setFitWidth(false);
              setScale((s) => Math.min(2.4, Number((s + 0.15).toFixed(2))));
            }}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(148, 163, 184, 0.25)',
              color: '#e2e8f0',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => {
              setFitWidth(true);
              setScale(1.0);
            }}
            style={{
              padding: '4px 9px',
              borderRadius: '6px',
              background: fitWidth ? 'rgba(56, 189, 248, 0.18)' : 'rgba(30, 41, 59, 0.9)',
              border: fitWidth
                ? '1px solid rgba(56, 189, 248, 0.45)'
                : '1px solid rgba(148, 163, 184, 0.25)',
              color: '#38bdf8',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title="Fit Page to Width"
          >
            Fit Width
          </button>
        </div>
      </div>

      {/* Scrollable React-PDF Viewport */}
      <div
        ref={viewportRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: compact
            ? '0.6rem'
            : 'clamp(0.65rem, 2.5vw, 1.25rem) clamp(0.45rem, 2vw, 1rem) 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {loading && !documentFile && documentLoadingNode}

        {errorMsg && !loading && (
          <div
            style={{
              margin: 'auto',
              padding: '2rem',
              textAlign: 'center',
              color: '#fca5a5',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              maxWidth: '460px',
            }}
          >
            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700 }}>Could not render PDF preview</p>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#cbd5e1' }}>{errorMsg}</p>
          </div>
        )}

        {!errorMsg && documentFile && (
          <PdfErrorBoundary
            key={cacheKey}
            onBoundaryError={() => setUseDirectFallback(true)}
            fallback={
              <DirectPdfJsFallback
                pdfBytes={pdfBytes}
                cacheKey={cacheKey}
                effectiveWidth={effectiveWidth}
                onLoaded={handleDirectLoaded}
                onError={handleDirectError}
              />
            }
          >
            {useDirectFallback ? (
              <DirectPdfJsFallback
                pdfBytes={pdfBytes}
                cacheKey={cacheKey}
                effectiveWidth={effectiveWidth}
                onLoaded={handleDirectLoaded}
                onError={handleDirectError}
              />
            ) : (
              <Document
                suspense={false}
                file={documentFile}
                options={documentOptions}
                onLoadSuccess={handleDocumentLoadSuccess}
                onLoadError={handleDocumentLoadError}
                loading={documentLoadingNode}
              >
                {numPages > 0
                  ? Array.from({ length: numPages }, (_, idx) => (
                      <ReactPdfPageWrapper
                        key={`${cacheKey}_page_${idx + 1}`}
                        cacheKey={cacheKey}
                        pageNumber={idx + 1}
                        totalPages={numPages}
                        targetWidth={baseTargetWidth}
                        scale={scale}
                        previewImage={idx === 0 ? previewImage : null}
                      />
                    ))
                  : documentLoadingNode}
              </Document>
            )}
          </PdfErrorBoundary>
        )}
      </div>
    </div>
  );
};
