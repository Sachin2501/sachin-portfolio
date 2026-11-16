// Centralized API configuration
// Always resolves /api/* requests against the same-origin Express / Vercel Serverless backend
// so external sleeping Render URLs in VITE_API_BASE_URL never cause "Failed to fetch" errors.

export const API_BASE_URL = '';

export const buildApiUrl = (endpoint) => {
  if (!endpoint) return '/api';
  const raw = String(endpoint).trim();
  const stripped = raw.replace(/^https?:\/\/[^/]*onrender\.com/i, '');
  if (stripped.startsWith('http://') || stripped.startsWith('https://')) {
    return stripped;
  }
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
};

export const apiFetch = (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint);
  return fetch(url, options);
};

