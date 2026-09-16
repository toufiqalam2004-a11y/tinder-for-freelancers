/**
 * Centralized API Base URL and Endpoint Resolver
 * Supports VITE_API_BASE_URL for decoupled subdomain/production architecture:
 * e.g., https://api.yourdomain.com/api or /api (reverse-proxy / local)
 */

export function getApiBaseUrl() {
  let envBase = '';
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    envBase = String(import.meta.env.VITE_API_BASE_URL).trim();
  } else if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    envBase = String(process.env.VITE_API_BASE_URL).trim();
  }
  envBase = envBase.replace(/\/+$/, '');

  if (!envBase) return '/api';
  if (envBase.endsWith('/api')) return envBase;
  return `${envBase}/api`;
}

export function getAdminApiBaseUrl() {
  return `${getApiBaseUrl()}/admin`;
}

export function getApiUrl(path = '') {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/')) {
    return `${base}${cleanPath.slice(4)}`;
  }
  return `${base}${cleanPath}`;
}
