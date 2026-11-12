import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

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
 * Render the first page of a PDF to a high-res PNG/JPEG data URL.
 */
export const renderPdfFirstPageToPng = async (pdfSource) => {
  try {
    let loadingTask;
    if (typeof pdfSource === 'string' && pdfSource.startsWith('data:')) {
      const uint8 = base64ToUint8Array(pdfSource);
      loadingTask = pdfjsLib.getDocument({ data: uint8 });
    } else {
      const response = await fetch(pdfSource);
      const arrayBuffer = await response.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    }
    const pdfDoc = await loadingTask.promise;
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
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

const PdfPageCanvas = ({ pdfDoc, pageNumber, totalPages, scale, fitWidth }) => {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pageDimensions, setPageDimensions] = useState({ width: 794, height: 1123 });

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return undefined;

    const updateWidth = () => {
      if (el.clientWidth) {
        setContainerWidth(el.clientWidth);
      }
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let renderTask = null;

    const renderPage = async () => {
      if (!pdfDoc || !canvasRef.current) return;
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (isCancelled) return;

        // Calculate high-DPI render scale for crisp text on all screens
        const dpr = Math.min(window.devicePixelRatio || 1, 2.25);
        const baseViewport = page.getViewport({ scale: 1.0 });
        const measuredWidth =
          containerWidth ||
          (wrapperRef.current?.clientWidth ? wrapperRef.current.clientWidth : 820);
        const availableWidth = Math.max(220, measuredWidth - 8);

        const effectiveScale = fitWidth
          ? Math.min(1.6, Math.max(0.25, availableWidth / baseViewport.width)) * scale
          : scale * 1.25;

        const displayViewport = page.getViewport({ scale: effectiveScale });
        const renderViewport = page.getViewport({ scale: effectiveScale * dpr });

        setPageDimensions({
          width: Math.floor(displayViewport.width),
          height: Math.floor(displayViewport.height),
        });

        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        canvas.width = Math.floor(renderViewport.width);
        canvas.height = Math.floor(renderViewport.height);

        renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        });
        await renderTask.promise;
        if (!isCancelled) {
          setRendering(false);
        }
      } catch (err) {
        if (!isCancelled && err?.name !== 'RenderingCancelledException') {
          console.error(`Error rendering PDF page ${pageNumber}:`, err);
          setRendering(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTask && typeof renderTask.cancel === 'function') {
        renderTask.cancel();
      }
    };
  }, [pdfDoc, pageNumber, scale, fitWidth, containerWidth]);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        marginBottom: totalPages > 1 ? '1.5rem' : '0.5rem',
        flexShrink: 0,
      }}
    >
      {totalPages > 1 && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '0.5rem',
            padding: '3px 12px',
            borderRadius: '999px',
            background: 'rgba(30, 41, 59, 0.85)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
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
          position: 'relative',
          width: '100%',
          display: 'flex',
          justifyContent: scale > 1.15 ? 'flex-start' : 'center',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            background: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            width: scale <= 1.05 ? `${pageDimensions.width}px` : `${pageDimensions.width}px`,
            maxWidth: scale <= 1.05 ? '100%' : 'none',
            height: 'auto',
            aspectRatio: `${pageDimensions.width} / ${pageDimensions.height}`,
            display: 'block',
            margin: '0 auto',
          }}
        />
        {rendering && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '0.84rem',
              fontWeight: 600,
            }}
          >
            Rendering page {pageNumber}...
          </div>
        )}
      </div>
    </div>
  );
};

export const PdfCanvasViewer = ({
  src,
  url,
  title = 'Document Preview',
  compact = false,
  initialScale = 1.0,
  onError,
}) => {
  const pdfSource = src || url;
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(compact ? 0.95 : initialScale);
  const [fitWidth, setFitWidth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    let loadedDocument = null;

    const loadPdf = async () => {
      if (!pdfSource) return;
      setLoading(true);
      setErrorMsg(null);
      setPdfDoc(null);
      setNumPages(0);

      try {
        let docData;
        if (typeof pdfSource === 'string' && pdfSource.startsWith('data:')) {
          docData = base64ToUint8Array(pdfSource);
        } else {
          const resolvedUrl =
            typeof pdfSource === 'string' && !pdfSource.startsWith('blob:')
              ? encodeURI(pdfSource)
              : pdfSource;
          const res = await fetch(resolvedUrl);
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} while loading PDF`);
          }
          const buf = await res.arrayBuffer();
          docData = new Uint8Array(buf);
        }

        // Verify valid %PDF- magic bytes within first 1024 bytes before invoking pdfjs worker
        const headerWindow = Math.min(docData.length, 1024);
        let pdfHeaderOffset = -1;
        for (let i = 0; i <= headerWindow - 5; i++) {
          if (
            docData[i] === 0x25 && // %
            docData[i + 1] === 0x50 && // P
            docData[i + 2] === 0x44 && // D
            docData[i + 3] === 0x46 && // F
            docData[i + 4] === 0x2d // -
          ) {
            pdfHeaderOffset = i;
            break;
          }
        }

        if (pdfHeaderOffset === -1) {
          throw new Error('The selected document is not a valid PDF file.');
        }

        if (pdfHeaderOffset > 0) {
          docData = docData.slice(pdfHeaderOffset);
        }

        const loadingTask = pdfjsLib.getDocument({
          data: docData,
          verbosity: 0,
        });
        loadedDocument = await loadingTask.promise;

        if (!isCancelled) {
          setPdfDoc(loadedDocument);
          setNumPages(loadedDocument.numPages || 1);
          setLoading(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setErrorMsg(err?.message || 'Unable to render PDF document.');
          setLoading(false);
          if (typeof onError === 'function') {
            onError(err);
          }
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (loadedDocument && typeof loadedDocument.destroy === 'function') {
        loadedDocument.destroy();
      }
    };
  }, [pdfSource, onError]);

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

      {/* Scrollable Canvas Pages Viewport (Top-aligned so Page 1 is never clipped) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'auto',
          padding: compact ? '0.6rem' : 'clamp(0.65rem, 2.5vw, 1.25rem) clamp(0.45rem, 2vw, 1rem) 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {loading && (
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
        )}

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

        {!loading &&
          !errorMsg &&
          pdfDoc &&
          Array.from({ length: numPages }, (_, idx) => (
            <PdfPageCanvas
              key={idx + 1}
              pdfDoc={pdfDoc}
              pageNumber={idx + 1}
              totalPages={numPages}
              scale={scale}
              fitWidth={fitWidth}
            />
          ))}
      </div>
    </div>
  );
};
