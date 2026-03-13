import api from '../services/api';
import { User } from '../types';

export interface TwoFactorStatus {
  is_enabled: boolean;
  has_setup: boolean;
  preferred_method: 'totp' | 'email' | 'sms';
  is_required: boolean;
  available_methods: ('totp' | 'email' | 'sms')[];
}

export interface TwoFactorSetupResult {
  method: string;
  secret?: string;
  qr_code?: string;
  otpauth_url?: string;
}

/**
 * Auth Model
 * Handles all authentication-related operations
 */
export class AuthModel {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string, rememberMe?: boolean) {
    const response = await api.post<{
      success: boolean;
      message: string;
      requires_2fa?: boolean;
      two_factor_method?: string;
      temp_token?: string;
      challenge_id?: string;
      data: { token: string; user: User; requires_2fa?: boolean; two_factor_method?: string; temp_token?: string; challenge_id?: string };
    }>('/auth/login', { email, password, rememberMe });
    // Hoist 2FA fields into data so callers can find them in one place
    if (response.data.requires_2fa && response.data.data) {
      response.data.data.requires_2fa = true;
      response.data.data.two_factor_method = response.data.two_factor_method;
      response.data.data.temp_token = response.data.temp_token;
      response.data.data.challenge_id = response.data.challenge_id;
    } else if (response.data.requires_2fa) {
      // Backend may omit `data` entirely on a 2FA challenge
      (response.data as any).data = {
        token: '',
        user: {} as User,
        requires_2fa: true,
        two_factor_method: response.data.two_factor_method,
        temp_token: response.data.temp_token,
        challenge_id: response.data.challenge_id,
      };
    }
    return response.data;
  }

  /**
   * Register a new user
   */
  static async register(data: { name: string; email: string; password: string; company_name?: string; phone?: string; address?: string }) {
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
    localStorage.removeItem('masquerade_admin_restore_token');
    localStorage.removeItem('masquerade_admin_id');
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

  // ─── Masquerade (Admin login-as-user) ────────────────────────

  /**
   * Start masquerading: save admin's session and switch to target user
   */
  static startMasquerade(token: string, user: User, adminRestoreToken: string, adminId: string) {
    // Save admin restore token for later
    localStorage.setItem('masquerade_admin_restore_token', adminRestoreToken);
    localStorage.setItem('masquerade_admin_id', adminId);
    // Replace active session with target user
    this.storeAuth(token, user);
  }

  /**
   * Check if currently masquerading
   */
  static isMasquerading(): boolean {
    return !!localStorage.getItem('masquerade_admin_restore_token');
  }

  /**
   * Get masquerade admin ID
   */
  static getMasqueradeAdminId(): string | null {
    return localStorage.getItem('masquerade_admin_id');
  }

  /**
   * Exit masquerade and restore admin session
   */
  static async exitMasquerade(): Promise<{ token: string; user: User }> {
    const adminRestoreToken = localStorage.getItem('masquerade_admin_restore_token');
    if (!adminRestoreToken) {
      throw new Error('No masquerade session to exit');
    }

    const response = await api.post<{ success: boolean; data: { token: string; user: User } }>(
      '/auth/masquerade/exit',
      { adminRestoreToken }
    );

    // Clear masquerade state
    localStorage.removeItem('masquerade_admin_restore_token');
    localStorage.removeItem('masquerade_admin_id');

    const { token, user } = response.data.data;
    this.storeAuth(token, user);

    return { token, user };
  }

  /**
   * Clear all masquerade state (used on logout)
   */
  static clearMasquerade() {
    localStorage.removeItem('masquerade_admin_restore_token');
    localStorage.removeItem('masquerade_admin_id');
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
    notifications_enabled?: boolean;
    push_notifications_enabled?: boolean;
    web_notifications_enabled?: boolean;
  }) {
    // Transform frontend fields to backend format
    const name = data.first_name && data.last_name 
      ? `${data.first_name} ${data.last_name}`.trim()
      : data.username || '';
    
    const payload: Record<string, any> = { name };
    if (data.email) payload.email = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.notifications_enabled !== undefined) payload.notifications_enabled = data.notifications_enabled;
    if (data.push_notifications_enabled !== undefined) payload.push_notifications_enabled = data.push_notifications_enabled;
    if (data.web_notifications_enabled !== undefined) payload.web_notifications_enabled = data.web_notifications_enabled;

    const response = await api.put<{ success: boolean; message: string; user: User }>(
      '/profile',
      payload
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

  // ─── Two-Factor Authentication ─────────────────────────────────

  /** Get 2FA status for current user */
  static async get2FAStatus(): Promise<TwoFactorStatus> {
    const response = await api.get<{ success: boolean; data: TwoFactorStatus }>('/auth/2fa/status');
    return response.data.data;
  }

  /** Start 2FA setup for a given method */
  static async setup2FA(method: 'totp' | 'email' | 'sms'): Promise<TwoFactorSetupResult> {
    const response = await api.post<{ success: boolean; message: string; data: TwoFactorSetupResult }>(
      '/auth/2fa/setup',
      { method }
    );
    return response.data.data;
  }

  /** Verify setup code to enable 2FA */
  static async verifySetup2FA(code: string): Promise<{ backup_codes: string[]; method: string }> {
    const response = await api.post<{ success: boolean; data: { backup_codes: string[]; method: string } }>(
      '/auth/2fa/verify-setup',
      { code }
    );
    return response.data.data;
  }

  /** Verify 2FA code during login */
  static async verify2FA(tempToken: string, code: string) {
    const response = await api.post<{
      success: boolean;
      message: string;
      data: { token: string; user: User; used_backup_code: boolean; remaining_backup_codes: number };
    }>('/auth/2fa/verify', { temp_token: tempToken, code });
    return response.data;
  }

  /** Poll push-to-approve challenge status (called during login when challenge_id exists) */
  static async pollPushStatus(tempToken: string, challengeId: string): Promise<{
    status: 'pending' | 'completed' | 'denied' | 'expired' | 'not_found';
    token?: string;
    user?: User;
  }> {
    const response = await api.post<{
      success: boolean;
      data: { status: string; token?: string; user?: User };
      token?: string;
      user?: User;
    }>('/auth/2fa/push-status', { temp_token: tempToken, challenge_id: challengeId });
    const data = response.data.data;
    return {
      status: data.status as any,
      token: data.token || response.data.token,
      user: data.user || response.data.user,
    };
  }

  /** Resend OTP (for email/SMS methods) */
  static async resend2FAOtp(tempToken: string) {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/2fa/send-otp',
      { temp_token: tempToken }
    );
    return response.data;
  }

  /** Send alternative OTP (e.g. email) when primary method is unavailable (push/TOTP not working) */
  static async sendAltOtp(tempToken: string, method: 'email' | 'sms' = 'email') {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/2fa/send-alt-otp',
      { temp_token: tempToken, method }
    );
    return response.data;
  }

  /** Disable 2FA (requires password) — blocked for staff/admin */
  static async disable2FA(password: string) {
    const response = await api.post<{ success: boolean; message: string }>(
      '/auth/2fa/disable',
      { password }
    );
    return response.data;
  }

  /** Change 2FA method (requires password) */
  static async change2FAMethod(method: 'totp' | 'email' | 'sms', password: string) {
    const response = await api.put<{ success: boolean; message: string; data: any }>(
      '/auth/2fa/method',
      { method, password }
    );
    return response.data;
  }

  /** Regenerate backup codes (requires password) */
  static async regenerateBackupCodes(password: string): Promise<string[]> {
    const response = await api.post<{ success: boolean; data: { backup_codes: string[] } }>(
      '/auth/2fa/backup-codes',
      { password }
    );
    return response.data.data.backup_codes;
  }

  // ─── Mobile QR Authentication ──────────────────────────────────

  /** Check for pending mobile auth challenge (web profile polls this) */
  static async getMobileAuthQR(): Promise<{
    has_pending: boolean;
    challenge_id?: string;
    challenge_code?: string;
    qr_code?: string;
    expires_at?: string;
  }> {
    const response = await api.get<{ success: boolean; data: any }>('/auth/2fa/mobile-qr');
    return response.data.data;
  }

  /** Poll challenge status (web profile checks if mobile scanned) */
  static async getMobileAuthStatus(challengeId: string): Promise<{ status: string }> {
    const response = await api.get<{ success: boolean; data: { status: string } }>(
      `/auth/2fa/mobile-qr/status/${challengeId}`
    );
    return response.data.data;
  }

  // ─── PIN-Based Quick Login ──────────────────────────────────────

  /** Check if current user has a PIN set (requires auth) */
  static async getPinStatus(): Promise<{ has_pin: boolean }> {
    const response = await api.get<{ success: boolean; data: { has_pin: boolean } }>('/auth/pin/status');
    return response.data.data;
  }

  /** Set or update the user's PIN (requires auth + password) */
  static async setPin(pin: string, password: string): Promise<void> {
    await api.post('/auth/pin/set', { pin, password });
  }

  /** Remove the user's PIN (requires auth) */
  static async removePin(): Promise<void> {
    await api.delete('/auth/pin');
  }

  /** Check if an email has PIN login enabled (public, no auth needed) */
  static async checkPinByEmail(email: string): Promise<{ has_pin: boolean }> {
    const response = await api.get<{ success: boolean; data: { has_pin: boolean } }>(
      `/auth/pin/check/${encodeURIComponent(email)}`
    );
    return response.data.data;
  }

  /** Quick login with email + PIN (public, no auth needed) */
  static async loginWithPin(email: string, pin: string) {
    const response = await api.post<{
      success: boolean;
      message: string;
      requires_2fa?: boolean;
      two_factor_method?: string;
      temp_token?: string;
      challenge_id?: string;
      data: { token: string; user: User; requires_2fa?: boolean; two_factor_method?: string; temp_token?: string; challenge_id?: string };
    }>('/auth/pin/verify', { email, pin });
    // Hoist 2FA fields into data (same pattern as login)
    if (response.data.requires_2fa && response.data.data) {
      response.data.data.requires_2fa = true;
      response.data.data.two_factor_method = response.data.two_factor_method;
      response.data.data.temp_token = response.data.temp_token;
      response.data.data.challenge_id = response.data.challenge_id;
    } else if (response.data.requires_2fa) {
      (response.data as any).data = {
        token: '',
        user: {} as User,
        requires_2fa: true,
        two_factor_method: response.data.two_factor_method,
        temp_token: response.data.temp_token,
        challenge_id: response.data.challenge_id,
      };
    }
    return response.data;
  }

  /** Store the last logged-in email for PIN quick login */
  static setLastEmail(email: string) {
    localStorage.setItem('last_login_email', email);
  }

  /** Get the last logged-in email */
  static getLastEmail(): string | null {
    return localStorage.getItem('last_login_email');
  }
}
