// Centralized API configuration supporting separate deployments
// In development: defaults to relative '/api' (same origin)
// In production (when deployed separately on Vercel/Netlify):
// set VITE_API_BASE_URL=https://your-backend.onrender.com

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const buildApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (!API_BASE_URL) return cleanEndpoint;
  return `${API_BASE_URL}${cleanEndpoint}`;
};

export const apiFetch = (endpoint, options = {}) => {
  const url = buildApiUrl(endpoint);
  return fetch(url, options);
};
