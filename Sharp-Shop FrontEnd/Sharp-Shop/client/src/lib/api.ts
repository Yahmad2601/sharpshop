// API configuration - use empty string for relative paths since Express serves both frontend and API
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Python chat/checkout/payment service (separate deployment).
// In production set VITE_CHAT_API_URL. Otherwise default to the SAME host the
// app was loaded from, on port 8000 — so it works over localhost AND over a LAN
// IP (e.g. a phone hitting http://192.168.x.x:5000 reaches :8000 on that host).
function resolveChatApiBase(): string {
  const configured = import.meta.env.VITE_CHAT_API_URL;
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

export const CHAT_API_BASE = resolveChatApiBase();

export const apiClient = {
  async fetch(endpoint: string, options?: RequestInit) {
    const url = `${API_BASE_URL}${endpoint}`;
    return fetch(url, {
      ...options,
      credentials: 'include',
    });
  }
};
