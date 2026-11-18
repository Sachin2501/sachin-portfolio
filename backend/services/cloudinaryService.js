import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import dns from 'dns';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_PDF_MIME_TYPES = new Set([
  'application/pdf',
]);

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const ALLOWED_PDF_EXTENSIONS = new Set(['.pdf']);
const ALL_ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const CLOUDINARY_CERTIFICATES_FOLDER = 'portfolio/certificates';
export const CLOUDINARY_RESUME_FOLDER = 'portfolio/resume';

/**
 * Configure and return whether Cloudinary credentials are set in environment.
 */
export function ensureCloudinaryConfigured() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return true;
}

/**
 * Validate an uploaded multer file object on the server:
 * - Allowed types only: pdf, jpg, jpeg, png, webp
 * - Max size: 5 MB for images, 10 MB for PDFs
 */
export function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  const originalName = String(file.originalname || 'file').trim();
  const ext = path.extname(originalName).toLowerCase();
  const mime = String(file.mimetype || '').toLowerCase().trim();
  const size = Number(file.size ?? file.buffer.length ?? 0);

  const isPdfMime = ALLOWED_PDF_MIME_TYPES.has(mime);
  const isPdfExt = ALLOWED_PDF_EXTENSIONS.has(ext);
  const isImgMime = ALLOWED_IMAGE_MIME_TYPES.has(mime);
  const isImgExt = ALLOWED_IMAGE_EXTENSIONS.has(ext);

  // Must match either valid PDF or valid Image
  const isPdf = isPdfMime || (isPdfExt && (!mime || mime === 'application/octet-stream'));
  const isImage = isImgMime || (isImgExt && (!mime || mime === 'application/octet-stream'));

  // Reject if extension is explicitly disallowed or MIME is not in allowed sets
  if (ext && !ALLOWED_PDF_EXTENSIONS.has(ext) && !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Invalid file type "${ext}". Allowed file types: PDF, JPG, JPEG, PNG, WEBP.`,
    };
  }

  if (!isPdf && !isImage) {
    return {
      valid: false,
      error: `Unsupported file type (${mime || ext || 'unknown'}). Allowed file types: PDF, JPG, JPEG, PNG, WEBP.`,
    };
  }

  if (isPdf && size > MAX_PDF_SIZE_BYTES) {
    const sizeMb = (size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `PDF file size (${sizeMb} MB) exceeds the maximum allowed limit of 10 MB.`,
    };
  }

  if (isImage && size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `Image file size (${sizeMb} MB) exceeds the maximum allowed limit of 5 MB.`,
    };
  }

  return {
    valid: true,
    fileType: isPdf ? 'pdf' : 'image',
    originalName,
    mimetype: isPdf ? 'application/pdf' : mime,
    size,
  };
}

/**
 * Upload a file buffer to Cloudinary using upload_stream with resource_type: "auto".
 * Saves into the specified folder ("portfolio/certificates" or "portfolio/resume").
 */
export async function uploadBufferToCloudinary(file, folder = CLOUDINARY_CERTIFICATES_FOLDER) {
  const validation = validateUploadedFile(file);
  if (!validation.valid) {
    const err = new Error(validation.error);
    err.statusCode = 400;
    throw err;
  }

  if (!ensureCloudinaryConfigured()) {
    const err = new Error(
      'Cloudinary is not configured on the server. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your environment variables.'
    );
    err.statusCode = 500;
    throw err;
  }

  const baseName = path
    .basename(validation.originalName, path.extname(validation.originalName))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 60);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        filename_override: baseName || 'document',
      },
      (error, result) => {
        if (error || !result) {
          const uploadErr = new Error(
            error?.message || 'Failed to upload file to Cloudinary.'
          );
          uploadErr.statusCode = 502;
          return reject(uploadErr);
        }

        resolve({
          fileUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type || (validation.fileType === 'pdf' ? 'image' : 'image'),
          fileType: validation.fileType,
          originalName: validation.originalName,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

/**
 * Parse a legacy Cloudinary URL to derive publicId, resourceType, and fileType
 * when publicId was not explicitly stored in the database.
 */
export function parseCloudinaryUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.includes('res.cloudinary.com/')) return null;

  try {
    const parsedUrl = new URL(trimmed);
    if (!parsedUrl.hostname.includes('cloudinary.com')) return null;

    const pathname = decodeURIComponent(parsedUrl.pathname);
    // Match /<resource_type>/upload/...
    const match = pathname.match(/\/(image|raw|video)\/upload\/(.+)$/i);
    if (!match) return null;

    const resourceType = match[1].toLowerCase();
    let afterUpload = match[2];

    // Strip any transformation segments before the version segment (e.g. "c_scale,w_500/v1234567/...")
    const versionMatch = afterUpload.match(/(?:^|\/)v\d+\/(.+)$/);
    if (versionMatch) {
      afterUpload = versionMatch[1];
    } else {
      // If there is no v123456 segment, strip transformation segments containing commas or key_value
      const segments = afterUpload.split('/');
      while (segments.length > 1 && (segments[0].includes(',') || /^[a-z]{1,3}_/.test(segments[0]))) {
        segments.shift();
      }
      afterUpload = segments.join('/');
    }

    if (!afterUpload) return null;

    const lowerPath = afterUpload.toLowerCase();
    const isPdf = lowerPath.endsWith('.pdf');
    const fileType = isPdf ? 'pdf' : 'image';

    const publicIdWithoutExt = afterUpload.replace(/\.[a-zA-Z0-9]+$/, '');
    const publicId = resourceType === 'raw' ? afterUpload : publicIdWithoutExt;

    if (!publicId) return null;

    return {
      fileUrl: trimmed,
      publicId,
      publicIdWithoutExt,
      publicIdWithExt: afterUpload,
      resourceType,
      fileType,
    };
  } catch {
    return null;
  }
}

/**
 * Delete a file from Cloudinary using its publicId and resourceType.
 * Handles missing files ("not found") or unconfigured credentials gracefully
 * without throwing so database deletion is never blocked.
 */
export async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId || typeof publicId !== 'string') {
    return { deleted: false, reason: 'missing_public_id' };
  }

  if (!ensureCloudinaryConfigured()) {
    return { deleted: false, reason: 'cloudinary_not_configured' };
  }

  const normalizedType = ['image', 'raw', 'video'].includes(String(resourceType).toLowerCase())
    ? String(resourceType).toLowerCase()
    : 'image';

  try {
    const res = await cloudinary.uploader.destroy(publicId, {
      resource_type: normalizedType,
      invalidate: true,
    });

    if (res?.result === 'ok') {
      return { deleted: true, result: res.result, resourceType: normalizedType };
    }

    // If result is "not found", try alternate resource_type ('raw' <-> 'image') or with/without extension
    const altType = normalizedType === 'image' ? 'raw' : 'image';
    const altRes = await cloudinary.uploader.destroy(publicId, {
      resource_type: altType,
      invalidate: true,
    }).catch(() => null);

    if (altRes?.result === 'ok') {
      return { deleted: true, result: altRes.result, resourceType: altType };
    }

    // Also try without extension if publicId had an extension (e.g., .pdf)
    const strippedId = publicId.replace(/\.[a-zA-Z0-9]+$/, '');
    if (strippedId !== publicId) {
      const strippedRes = await cloudinary.uploader.destroy(strippedId, {
        resource_type: normalizedType,
        invalidate: true,
      }).catch(() => null);
      if (strippedRes?.result === 'ok') {
        return { deleted: true, result: strippedRes.result, resourceType: normalizedType };
      }
    }

    return {
      deleted: false,
      result: res?.result || 'not_found',
      resourceType: normalizedType,
    };
  } catch (err) {
    console.warn(`[Cloudinary Destroy Warning] publicId="${publicId}":`, err.message);
    return {
      deleted: false,
      reason: err.message || 'destroy_error',
      resourceType: normalizedType,
    };
  }
}

/**
 * Check if an IPv4 or IPv6 address is private, loopback, link-local, or reserved (SSRF protection).
 */
export function isPrivateOrReservedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;
  const trimmed = ip.trim().toLowerCase();

  // IPv6 checks
  if (trimmed.includes(':')) {
    if (
      trimmed === '::1' ||
      trimmed === '::' ||
      trimmed.startsWith('fe80:') ||
      trimmed.startsWith('fc') ||
      trimmed.startsWith('fd')
    ) {
      return true;
    }
    // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1
    const v4Mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (v4Mapped) {
      return isPrivateOrReservedIp(v4Mapped[1]);
    }
    return false;
  }

  // IPv4 checks
  const parts = trimmed.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // Multicast & reserved

  return false;
}

/**
 * Validate a public http/https URL and verify via DNS lookup that it does not resolve
 * to localhost or private/internal IP ranges (SSRF protection).
 */
export async function validateSafePublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, error: `Disallowed URL protocol "${parsed.protocol}" (only http/https allowed).` };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { safe: false, error: `Blocked internal hostname "${hostname}" (SSRF protection).` };
  }

  // Direct IP literal check
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.includes(':')) {
    if (isPrivateOrReservedIp(hostname)) {
      return { safe: false, error: `Blocked private/internal IP address "${hostname}" (SSRF protection).` };
    }
    return { safe: true, url: parsed.toString() };
  }

  try {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (!records || records.length === 0) {
      return { safe: false, error: `Could not resolve hostname "${hostname}".` };
    }
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        return {
          safe: false,
          error: `Hostname "${hostname}" resolved to private/internal IP "${rec.address}" (SSRF protection).`,
        };
      }
    }
  } catch (err) {
    return { safe: false, error: `DNS resolution failed for "${hostname}": ${err.message}` };
  }

  return { safe: true, url: parsed.toString() };
}

/**
 * Convert standard Google Drive file share links into direct download URLs.
 */
export function convertGoogleDriveUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('drive.google.com') && !host.includes('docs.google.com')) {
      return { isDrive: false, downloadUrl: rawUrl };
    }

    if (parsed.pathname.includes('/drive/folders/')) {
      return {
        isDrive: true,
        error: 'Google Drive folder links cannot be downloaded as a single certificate file.',
      };
    }

    // Pattern 1: /file/d/<FILE_ID>/view
    const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const fileId = fileMatch ? fileMatch[1] : parsed.searchParams.get('id');

    if (!fileId) {
      return {
        isDrive: true,
        error: 'Could not extract file ID from Google Drive link.',
      };
    }

    return {
      isDrive: true,
      fileId,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    };
  } catch {
    return { isDrive: false, downloadUrl: rawUrl };
  }
}

/**
 * Detect file type from magic bytes and filename extension:
 * - Allow ONLY: pdf, jpg, jpeg, png, webp
 * - Max size: 5 MB for images, 10 MB for PDFs
 */
export function detectAndValidateCertificateBuffer(buffer, filenameHint = 'certificate') {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return {
      valid: false,
      failureKind: 'failed',
      error: 'File is empty (0 bytes).',
    };
  }

  const size = buffer.length;
  const cleanHint = String(filenameHint || 'certificate').split('?')[0].split('#')[0].trim();
  const rawExt = path.extname(cleanHint).toLowerCase();

  // Check if buffer is an HTML page (e.g., Google Drive login/permission screen or 404 HTML page)
  const headText = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trim();
  if (
    /^<!doctype\s+html/i.test(headText) ||
    /^<html/i.test(headText) ||
    /^<head/i.test(headText) ||
    headText.includes('accounts.google.com/ServiceLogin')
  ) {
    return {
      valid: false,
      failureKind: 'failed',
      error: 'Source returned an HTML page instead of a certificate file (may require permission or login).',
    };
  }

  // Check if buffer or extension is SVG
  if (rawExt === '.svg' || /^<svg/i.test(headText) || (headText.startsWith('<?xml') && headText.includes('<svg'))) {
    return {
      valid: false,
      failureKind: 'skipped',
      error: `Unsupported file type "${rawExt || '.svg'}". Only PDF, JPG, JPEG, PNG, and WEBP are allowed.`,
    };
  }

  // If extension is present and explicitly not in allowed list, skip and report why
  if (rawExt && !ALL_ALLOWED_EXTENSIONS.has(rawExt)) {
    return {
      valid: false,
      failureKind: 'skipped',
      error: `Unsupported file extension "${rawExt}". Only PDF, JPG, JPEG, PNG, and WEBP are allowed.`,
    };
  }

  // Magic byte detection
  let detectedExt = '';
  let detectedMime = '';
  let detectedType = '';

  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d    // -
  ) {
    detectedExt = '.pdf';
    detectedMime = 'application/pdf';
    detectedType = 'pdf';
  } else if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    detectedExt = rawExt === '.jpeg' ? '.jpeg' : '.jpg';
    detectedMime = 'image/jpeg';
    detectedType = 'image';
  } else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedExt = '.png';
    detectedMime = 'image/png';
    detectedType = 'image';
  } else if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedExt = '.webp';
    detectedMime = 'image/webp';
    detectedType = 'image';
  }

  if (!detectedType) {
    return {
      valid: false,
      failureKind: 'skipped',
      error: `Unsupported or unrecognized file content (extension: "${rawExt || 'none'}"). Allowed types: PDF, JPG, JPEG, PNG, WEBP.`,
    };
  }

  if (detectedType === 'pdf' && size > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      failureKind: 'skipped',
      error: `PDF size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds the 10 MB limit.`,
    };
  }

  if (detectedType === 'image' && size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      failureKind: 'skipped',
      error: `Image size (${(size / (1024 * 1024)).toFixed(2)} MB) exceeds the 5 MB limit.`,
    };
  }

  let finalName = path.basename(cleanHint) || `certificate${detectedExt}`;
  if (!path.extname(finalName)) {
    finalName = `${finalName}${detectedExt}`;
  }

  return {
    valid: true,
    fileType: detectedType,
    mimetype: detectedMime,
    originalName: finalName,
    size,
    buffer,
  };
}

/**
 * Resolve an old certificate file from:
 * 1) Local path (starts with "/" or "./") inside allowed project folders (public/)
 * 2) Google Drive share link (converted to direct download URL)
 * 3) Public http(s) URL (with SSRF protection, 30s timeout, and 10 MB max download size)
 */
export async function resolveOldCertificateFile(rawSource, projectRootDir) {
  if (!rawSource || typeof rawSource !== 'string') {
    return { valid: false, failureKind: 'failed', error: 'Empty file source.' };
  }

  const trimmed = rawSource.trim();

  // 1. Local path (starts with "/" or "./")
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    const withoutQuery = trimmed.split('?')[0].split('#')[0];
    let decodedPath = withoutQuery;
    try {
      decodedPath = decodeURIComponent(withoutQuery);
    } catch {
      decodedPath = withoutQuery;
    }

    // Block path traversal (".." or null byte)
    if (
      withoutQuery.includes('..') ||
      decodedPath.includes('..') ||
      withoutQuery.includes('\0') ||
      decodedPath.includes('\0')
    ) {
      return {
        valid: false,
        failureKind: 'failed',
        error: 'Blocked path traversal attempt (".." is not allowed).',
      };
    }

    const relativeClean = decodedPath.replace(/^(\.\/|\/)+/, '');
    const publicDir = path.resolve(projectRootDir, 'public');
    const candidateInPublic = path.resolve(publicDir, relativeClean);

    // Must resolve strictly inside publicDir
    if (
      candidateInPublic !== publicDir &&
      !candidateInPublic.startsWith(publicDir + path.sep)
    ) {
      return {
        valid: false,
        failureKind: 'failed',
        error: 'Local path resolved outside allowed project public/ directory.',
      };
    }

    if (!fs.existsSync(candidateInPublic)) {
      return {
        valid: false,
        failureKind: 'failed',
        error: `Local file not found on disk: /${relativeClean}`,
      };
    }

    let stat;
    try {
      stat = fs.statSync(candidateInPublic);
    } catch (err) {
      return {
        valid: false,
        failureKind: 'failed',
        error: `Failed to stat local file: ${err.message}`,
      };
    }

    if (!stat.isFile()) {
      return {
        valid: false,
        failureKind: 'failed',
        error: `Local path is not a regular file: /${relativeClean}`,
      };
    }

    if (stat.size > MAX_PDF_SIZE_BYTES) {
      return {
        valid: false,
        failureKind: 'skipped',
        error: `Local file size (${(stat.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum 10 MB limit.`,
      };
    }

    try {
      const buffer = fs.readFileSync(candidateInPublic);
      return detectAndValidateCertificateBuffer(buffer, path.basename(candidateInPublic));
    } catch (err) {
      return {
        valid: false,
        failureKind: 'failed',
        error: `Failed to read local file: ${err.message}`,
      };
    }
  }

  // 2 & 3. Public http(s) URL or Google Drive share link
  if (/^https?:\/\//i.test(trimmed)) {
    let targetUrl = trimmed;
    const driveInfo = convertGoogleDriveUrl(trimmed);
    if (driveInfo.isDrive) {
      if (driveInfo.error) {
        return { valid: false, failureKind: 'failed', error: driveInfo.error };
      }
      targetUrl = driveInfo.downloadUrl;
    }

    const ssrfCheck = await validateSafePublicUrl(targetUrl);
    if (!ssrfCheck.safe) {
      return { valid: false, failureKind: 'failed', error: ssrfCheck.error };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(ssrfCheck.url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Portfolio-Certificate-Migrator/1.0',
        },
      });

      if (!response.ok) {
        return {
          valid: false,
          failureKind: 'failed',
          error: `Remote server returned HTTP ${response.status} (${response.statusText || 'Error'}).`,
        };
      }

      // Verify final redirected URL is also safe
      if (response.url && response.url !== ssrfCheck.url) {
        const redirectCheck = await validateSafePublicUrl(response.url);
        if (!redirectCheck.safe) {
          return { valid: false, failureKind: 'failed', error: redirectCheck.error };
        }
      }

      const contentType = String(response.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) {
        return {
          valid: false,
          failureKind: 'failed',
          error: driveInfo.isDrive
            ? 'Google Drive link requires permission/sign-in or returned an HTML confirmation page.'
            : 'Remote URL returned an HTML webpage instead of a PDF or image file.',
        };
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_PDF_SIZE_BYTES) {
        return {
          valid: false,
          failureKind: 'skipped',
          error: `Remote file size (${(contentLength / (1024 * 1024)).toFixed(2)} MB) exceeds maximum 10 MB limit.`,
        };
      }

      // Stream response body with strict 10 MB ceiling
      const chunks = [];
      let totalBytes = 0;

      if (response.body && typeof response.body.getReader === 'function') {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalBytes += value.byteLength;
            if (totalBytes > MAX_PDF_SIZE_BYTES) {
              await reader.cancel().catch(() => {});
              return {
                valid: false,
                failureKind: 'skipped',
                error: 'Remote file download exceeded maximum allowed size of 10 MB.',
              };
            }
            chunks.push(Buffer.from(value));
          }
        }
      } else {
        const arrBuf = await response.arrayBuffer();
        if (arrBuf.byteLength > MAX_PDF_SIZE_BYTES) {
          return {
            valid: false,
            failureKind: 'skipped',
            error: 'Remote file download exceeded maximum allowed size of 10 MB.',
          };
        }
        chunks.push(Buffer.from(arrBuf));
      }

      const buffer = Buffer.concat(chunks);

      // Extract filename hint from Content-Disposition or URL pathname
      let filenameHint = 'certificate';
      const disposition = response.headers.get('content-disposition') || '';
      const fileMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\r\n]+)["']?/i);
      if (fileMatch && fileMatch[1]) {
        try {
          filenameHint = decodeURIComponent(fileMatch[1]);
        } catch {
          filenameHint = fileMatch[1];
        }
      } else {
        try {
          const urlPathname = decodeURIComponent(new URL(trimmed).pathname);
          const base = path.basename(urlPathname);
          if (base && base !== 'view' && base !== 'open' && base !== 'uc') {
            filenameHint = base;
          } else if (driveInfo.fileId) {
            filenameHint = `gdrive_${driveInfo.fileId}`;
          }
        } catch {
          filenameHint = 'certificate';
        }
      }

      return detectAndValidateCertificateBuffer(buffer, filenameHint);
    } catch (err) {
      if (err.name === 'AbortError') {
        return {
          valid: false,
          failureKind: 'failed',
          error: 'Download timed out after 30 seconds.',
        };
      }
      return {
        valid: false,
        failureKind: 'failed',
        error: `Failed to download URL: ${err.message}`,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    valid: false,
    failureKind: 'failed',
    error: `Unsupported file source format "${trimmed.slice(0, 60)}". Expected local path (/...) or http(s) URL.`,
  };
}

