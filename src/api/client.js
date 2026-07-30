// Central place for talking to the Fine Arc backend. Every solver component
// should call apiFetch instead of the raw fetch() API so the auth token and
// 401 handling stay consistent across the app.

export const API_BASE = 'http://localhost:8000/api';

const TOKEN_KEY = 'finearc_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Thin wrapper around fetch() that:
 *  - prefixes paths with the API base
 *  - attaches the bearer token when one is stored
 *  - sets JSON content-type automatically (skipped for FormData bodies)
 *  - broadcasts a "finearc:unauthorized" event on 401 so the app can log out
 *
 * Returns the raw Response, same as fetch() — callers still do res.ok / res.json().
 */
export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('finearc:unauthorized'));
  }

  return res;
}
