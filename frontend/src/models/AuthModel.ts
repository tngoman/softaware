import api from '../services/api';
import { User } from '../types';

/**
 * Auth Model
 * Handles all authentication-related operations
 */
export class AuthModel {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string) {
    const response = await api.post<{ success: boolean; message: string; data: { token: string; user: User } }>(
      '/auth/login',
      { email, password }
    );
    return response.data;
  }

  /**
   * Register a new user
   */
  static async register(data: { name: string; email: string; password: string }) {
    const response = await api.post<{ success: boolean; message: string; data: { token: string; user: User } }>(
      '/auth/register',
      data
    );
    return response.data;
  }

  /**
   * Logout current user
   */
  static async logout() {
    const response = await api.post<{ success: boolean; message: string }>('/auth/logout');
    return response.data;
  }

  /**
   * Get current authenticated user
   */
  static async me() {
    const response = await api.get<{ success: boolean; message: string; data: { user: User } }>('/auth/me');
    return response.data.data;
  }

  /**
   * Get current user's permissions
   */
  static async getUserPermissions() {
    const response = await api.get<{ success: boolean; data: Array<{ id: number; name: string; slug: string }> }>('/auth/permissions');
    return response.data.data;
  }

  /**
   * Store authentication token and user in localStorage
   */
  static storeAuth(token: string, user: User) {
    localStorage.setItem('jwt_token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  /**
   * Clear authentication from localStorage
   */
  static clearAuth() {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
  }

  /**
   * Get stored token
   */
  static getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  /**
   * Get stored user
   */
  static getUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Failed to parse user from localStorage:', error);
      // Clear corrupted data
      localStorage.removeItem('user');
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Update user profile
   */
  static async updateProfile(data: { 
    username?: string; 
    email?: string; 
    first_name?: string; 
    last_name?: string;
    phone?: string;
  }) {
    const response = await api.put<{ success: boolean; message: string; data: { user: User } }>(
      '/auth/profile',
      data
    );
    return response.data;
  }

  /**
   * Change password
   */
  static async changePassword(data: { current_password: string; new_password: string }) {
    const response = await api.put<{ success: boolean; message: string }>(
      '/auth/change-password',
      data
    );
    return response.data;
  }

  /**
   * Request password reset OTP
   */
  static async forgotPassword(email: string) {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/forgot-password',
      { email }
    );
    return response.data;
  }

  /**
   * Verify OTP for password reset
   */
  static async verifyOTP(email: string, otp: string) {
    const response = await api.post<{ success: boolean; message: string; data: { valid: boolean } }>(
      '/auth/verify-otp',
      { email, otp }
    );
    return response.data;
  }

  /**
   * Reset password using OTP
   */
  static async resetPassword(email: string, otp: string, new_password: string) {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/reset-password',
      { email, otp, new_password }
    );
    return response.data;
  }
}
