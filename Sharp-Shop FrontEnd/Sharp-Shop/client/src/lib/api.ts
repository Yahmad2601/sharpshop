// API configuration - use empty string for relative paths since Express serves both frontend and API
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Python chat/checkout/payment service (separate deployment)
export const CHAT_API_BASE = import.meta.env.VITE_CHAT_API_URL || 'http://localhost:8000';

export const apiClient = {
  async fetch(endpoint: string, options?: RequestInit) {
    const url = `${API_BASE_URL}${endpoint}`;
    return fetch(url, {
      ...options,
      credentials: 'include',
    });
  }
};
