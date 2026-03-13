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
  withCredentials: true, // Send/receive HTTP-only auth cookies
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

// ── Silent token refresh state ──────────────────────────────────
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function forceLogout() {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('user');
  // Try to clear the HTTP-only cookie too (best-effort, don't await)
  axios.post(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true }).catch(() => {});
  window.location.href = '/login';
}

// Add response interceptor to handle 401 and 403 errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 403 — permission denied
    if (error.response?.status === 403) {
      const message = error.response?.data?.error || error.response?.data?.message || 'You do not have permission to perform this action.';
      // Dynamically import toast to avoid circular deps
      import('react-hot-toast').then(({ default: toast }) => {
        toast.error(message, { duration: 5000, id: 'permission-denied' });
      });
      return Promise.reject(error);
    }

    // Only handle 401s
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const url = originalRequest?.url || '';
    const method = (originalRequest?.method || '').toLowerCase();

    const isAuthEndpoint = url.includes('/auth/');
    const isLoginAttempt = isAuthEndpoint && url.includes('/auth/login') && method === 'post';
    const isRegisterAttempt = isAuthEndpoint && url.includes('/auth/register');
    const isRefreshAttempt = isAuthEndpoint && url.includes('/auth/refresh');

    // Skip forced logout for login/register so UI can show feedback
    if (isLoginAttempt || isRegisterAttempt) {
      return Promise.reject(error);
    }

    // If the refresh call itself failed, force logout
    if (isRefreshAttempt) {
      forceLogout();
      return Promise.reject(error);
    }

    // Don't retry if we already retried this request
    if (originalRequest._retry) {
      forceLogout();
      return Promise.reject(error);
    }

    const storedToken = localStorage.getItem('jwt_token');

    // If no token in localStorage, try cookie-based session recovery
    // (handles the "clear cache" scenario where localStorage is wiped but cookie persists)
    if (!storedToken) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((newToken: string) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            originalRequest._retry = true;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      originalRequest._retry = true;

      try {
        // This call sends the HTTP-only cookie automatically (withCredentials)
        const sessionResponse = await axios.get(
          `${API_BASE_URL}/auth/session`,
          { withCredentials: true },
        );

        const { token: newToken, user } = sessionResponse.data.data;
        localStorage.setItem('jwt_token', newToken);
        localStorage.setItem('user', JSON.stringify(user));

        onTokenRefreshed(newToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        refreshSubscribers = [];
        forceLogout();
        return Promise.reject(error);
      }
    }

    // Attempt silent refresh
    if (isRefreshing) {
      // Another refresh is in progress — queue this request
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken: string) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          originalRequest._retry = true;
          resolve(api(originalRequest));
        });
      });
    }

    isRefreshing = true;
    originalRequest._retry = true;

    try {
      const refreshResponse = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { accessToken: storedToken },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true },
      );

      const newToken = refreshResponse.data.accessToken;
      localStorage.setItem('jwt_token', newToken);

      // Notify all queued requests
      onTokenRefreshed(newToken);
      isRefreshing = false;

      // Retry the original request with the new token
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      isRefreshing = false;
      refreshSubscribers = [];
      forceLogout();
      return Promise.reject(refreshError);
    }
  }
);

export default api;