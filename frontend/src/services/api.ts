import axios from 'axios';
import { getApiBaseUrl } from '../config/app';

/**
 * Axios instance with base configuration
 * 
 * All domain-specific API methods have been moved to Model classes.
 * Components should import from ../models instead of calling this directly.
 * 
 * Example:
 *   import { ContactModel } from '../models';
 *   const contacts = await ContactModel.getAll();
 */

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only logout on 401 for protected requests; let the caller handle login errors
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const method = (error.config?.method || '').toLowerCase();
      const message = (error.response?.data?.error || error.response?.data?.message || '').toLowerCase();

      const isAuthEndpoint = url.includes('/auth/');
      const isLoginAttempt = isAuthEndpoint && url.includes('/auth/login') && method === 'post';
      const isRegisterAttempt = isAuthEndpoint && url.includes('/auth/register');
      const isAuthCheck = isAuthEndpoint && (url.includes('/auth/me') || url.includes('/auth/profile'));
      const tokenIssues = message.includes('invalid token') || message.includes('token expired') || message.includes('unauthorized') || message.includes('no token provided');

      // Skip forced logout for login/register so UI can show feedback
      if (isLoginAttempt || isRegisterAttempt) {
        return Promise.reject(error);
      }

      if (tokenIssues || isAuthCheck || !isAuthEndpoint) {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user');
        setTimeout(() => {
          window.location.href = '/login';
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

export default api;