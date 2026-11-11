import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, FileText, Image as ImageIcon, X, Check, RefreshCw, Download, Eye } from 'lucide-react';
import { PdfCanvasViewer, base64ToUint8Array } from '../../portfolio-frontend/components/PdfCanvasViewer.jsx';

const convertDataUrlToBlobUrl = (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const meta = dataUrl.split(',')[0] || '';
    const mimeMatch = meta.match(/data:([^;]+);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const bytes = base64ToUint8Array(dataUrl);
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

export const FileUploadZone = ({
  label = 'Upload File',
  accept = 'image/*',
  value = '',
  onChange,
  allowPdf = false,
  helpText = 'Supports JPG, PNG, WebP up to 15MB',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [customUrlMode, setCustomUrlMode] = useState(false);
  const [showInlinePdfPreview, setShowInlinePdfPreview] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const fileInputRef = useRef(null);

  const isPdf =
    typeof value === 'string' &&
    (value.startsWith('data:application/pdf') ||
      value.toLowerCase().endsWith('.pdf') ||
      value.toLowerCase().includes('.pdf?'));

  const downloadPdfUrl = useMemo(() => {
    if (!isPdf || !value) return '';
    if (value.startsWith('data:')) {
      return convertDataUrlToBlobUrl(value) || value;
    }
    return encodeURI(value);
  }, [isPdf, value]);

  useEffect(() => {
    setErrorMsg(null);
    if (value) {
      setShowInlinePdfPreview(true);
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (downloadPdfUrl && downloadPdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadPdfUrl);
      }
    };
  }, [downloadPdfUrl]);

  const handleFileProcess = (file) => {
    if (!file) return;

    setErrorMsg(null);

    // Size limit check (20MB)
    const maxSizeBytes = 20 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMsg('File exceeds 20MB limit. Please choose a smaller file.');
      return;
    }

    const isImageFile = file.type.startsWith('image/');
    const isPdfFile = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');

    if (!isImageFile && !(allowPdf && isPdfFile)) {
      setErrorMsg(
        allowPdf
          ? 'Only image files (JPG, PNG, WebP) or PDF files are allowed.'
          : 'Only image files (JPG, PNG, WebP) are allowed.'
      );
      return;
    }

    setIsReading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const base64Result = e.target.result;

      // Compress large images (> 350KB) automatically for instant database save
      if (isImageFile && file.size > 350 * 1024 && typeof base64Result === 'string') {
        const img = new window.Image();
        img.onload = () => {
          try {
            const maxDim = 1400;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width >= height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.84);
            setIsReading(false);
            if (onChange) {
              onChange(compressed, {
                name: file.name,
                size: Math.round((compressed.length * 3) / 4),
                type: 'image/jpeg',
              });
            }
          } catch {
            setIsReading(false);
            if (onChange) {
              onChange(base64Result, {
                name: file.name,
                size: file.size,
                type: file.type || 'image/png',
              });
            }
          }
        };
        img.onerror = () => {
          setIsReading(false);
          if (onChange) {
            onChange(base64Result, {
              name: file.name,
              size: file.size,
              type: file.type || 'image/png',
            });
          }
        };
        img.src = base64Result;
        return;
      }

      setIsReading(false);
      if (isPdfFile) {
        setShowInlinePdfPreview(true);
      }
      if (onChange) {
        onChange(base64Result, {
          name: file.name,
          size: file.size,
          type: file.type || (isPdfFile ? 'application/pdf' : 'image/png'),
        });
      }
    };

    reader.onerror = () => {
      setIsReading(false);
      setErrorMsg('Failed to read file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setShowInlinePdfPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onChange) onChange('');
  };

  return (
    <div className="file-upload-zone-wrapper">
      <div className="upload-header-row">
        <label className="upload-label">
          <strong>{label}</strong>
        </label>
        <button
          type="button"
          className="btn-toggle-input-mode"
          onClick={() => setCustomUrlMode(!customUrlMode)}
        >
          {customUrlMode ? 'Switch to File Upload' : 'Enter URL / Path'}
        </button>
      </div>

      {customUrlMode ? (
        <div className="custom-url-input-box">
          <input
            type="text"
            className="seo-input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              allowPdf
                ? 'https://... or /certificates/... or data:application/pdf...'
                : 'https://... or /assets/...'
            }
          />
          <p className="field-hint">Paste an image URL, PDF link, or static asset path.</p>
        </div>
      ) : (
        <div>
          {value ? (
            /* Active File Preview Container */
            <div className="file-preview-card">
              {isPdf ? (
                /* PDF File Preview Badge + Native Canvas PDF Viewer (Zero Chrome Blocking) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
                  <div className="pdf-preview-box">
                    <div className="pdf-icon-badge">
                      <FileText size={28} style={{ color: '#f87171' }} />
                      <span className="pdf-tag">PDF</span>
                    </div>
                    <div className="pdf-meta">
                      <span className="pdf-filename">PDF Certificate Document Ready</span>
                      <span className="pdf-sub">
                        Rendered natively on Canvas · Ready to save to MongoDB
                      </span>
                    </div>
                    <div
                      className="pdf-actions"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}
                    >
                      <button
                        type="button"
                        className="btn-preview-link"
                        onClick={() => setShowInlinePdfPreview(!showInlinePdfPreview)}
                        title="Toggle inline PDF canvas viewer"
                        style={{ cursor: 'pointer' }}
                      >
                        <Eye size={14} />
                        <span>{showInlinePdfPreview ? 'Hide Preview' : 'Show PDF Preview'}</span>
                      </button>
                      {downloadPdfUrl && (
                        <a
                          href={downloadPdfUrl}
                          download="certificate_document.pdf"
                          className="btn-preview-link"
                          title="Download PDF file"
                        >
                          <Download size={14} />
                          <span>Download</span>
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn-change-file"
                        onClick={() => fileInputRef.current?.click()}
                        title="Replace with another file"
                      >
                        <RefreshCw size={13} />
                        <span>Change</span>
                      </button>
                      <button
                        type="button"
                        className="btn-remove-file"
                        onClick={handleClear}
                        title="Remove file"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {showInlinePdfPreview && (
                    <div
                      style={{
                        width: '100%',
                        maxHeight: '440px',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        background: '#0b1120',
                      }}
                    >
                      <PdfCanvasViewer
                        src={value}
                        title="Uploaded PDF Preview"
                        compact={true}
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Image File Preview Badge */
                <div className="image-preview-box">
                  <div className="image-thumb-wrap">
                    <img
                      src={value}
                      alt="Uploaded preview"
                      className="image-thumb-preview"
                      onError={(e) => {
                        e.target.src = '/assets/aistudio/projects-bg_f9111c06.png';
                      }}
                    />
                  </div>
                  <div className="image-meta">
                    <span className="image-status-text">
                      <Check size={14} className="text-green-400 inline" /> Photo ready for MongoDB
                    </span>
                    <span className="image-subtext">Click Change to replace or Remove to reset</span>
                  </div>
                  <div className="image-actions">
                    <button
                      type="button"
                      className="btn-change-file"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RefreshCw size={13} />
                      <span>Change</span>
                    </button>
                    <button
                      type="button"
                      className="btn-remove-file"
                      onClick={handleClear}
                      title="Remove image"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Dropzone box when empty */
            <div
              className={`dropzone-box ${isDragging ? 'dragging' : ''} ${isReading ? 'reading' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              {isReading ? (
                <div className="dropzone-reading-state">
                  <RefreshCw className="animate-spin text-cyan-400" size={28} />
                  <span>Processing file & encoding to MongoDB format...</span>
                </div>
              ) : (
                <div className="dropzone-idle-state">
                  <div className="dropzone-icons-row">
                    <ImageIcon size={24} className="text-cyan-400" />
                    {allowPdf && <FileText size={24} className="text-rose-400" />}
                    <Upload size={24} className="text-slate-400" />
                  </div>
                  <p className="dropzone-main-text">
                    <strong>Click to browse</strong> or drag & drop file here
                  </p>
                  <p className="dropzone-sub-text">
                    {allowPdf
                      ? 'JPG, PNG, WebP or PDF documents (Auto-saved to MongoDB)'
                      : helpText}
                  </p>
                </div>
              )}
            </div>
          )}

          {errorMsg && <div className="upload-error-msg">{errorMsg}</div>}

          {/* Hidden HTML File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={allowPdf ? 'image/*,application/pdf,.pdf' : accept}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileProcess(e.target.files[0]);
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;
