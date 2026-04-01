import { create } from 'zustand';
import api from '../lib/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('englicode_token') || null,
  loading: true,
  error: null,

  // Admin local login
  adminLogin: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/admin/login', { email, password });
      const { token, user } = data.data;
      localStorage.setItem('englicode_token', token);
      set({ token, user, loading: false });
      return true;
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      set({ error: msg, loading: false });
      return false;
    }
  },

  // Fetch current user from token
  fetchUser: async () => {
    const token = localStorage.getItem('englicode_token');
    if (!token) {
      set({ user: null, token: null, loading: false });
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, token, loading: false });
    } catch {
      localStorage.removeItem('englicode_token');
      set({ user: null, token: null, loading: false });
    }
  },

  // Admin impersonation — login as any user
  impersonate: async (userId) => {
    try {
      const { data } = await api.post(`/auth/impersonate/${userId}`);
      const { token, user } = data.data;
      // Stash admin token so we can return
      const currentToken = localStorage.getItem('englicode_token');
      localStorage.setItem('englicode_admin_token', currentToken);
      localStorage.setItem('englicode_token', token);
      set({ token, user, impersonating: true });
      return true;
    } catch {
      return false;
    }
  },

  stopImpersonating: () => {
    const adminToken = localStorage.getItem('englicode_admin_token');
    if (adminToken) {
      localStorage.setItem('englicode_token', adminToken);
      localStorage.removeItem('englicode_admin_token');
      set({ token: adminToken, impersonating: false });
      // Re-fetch admin user
      useAuthStore.getState().fetchUser();
    }
  },

  impersonating: !!localStorage.getItem('englicode_admin_token'),

  logout: () => {
    localStorage.removeItem('englicode_token');
    localStorage.removeItem('englicode_admin_token');
    set({ user: null, token: null, impersonating: false });
  },
}));

export default useAuthStore;
