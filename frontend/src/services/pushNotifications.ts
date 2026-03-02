/**
 * Push Notification Service
 * Handles FCM token registration/deregistration with the backend,
 * foreground notification display, and permission management.
 */
import api from './api';
import { requestPushPermission, onForegroundMessage } from '../config/firebase';

const FCM_TOKEN_KEY = 'fcm_device_token';

/**
 * Get the device platform (android/ios/web)
 */
function getDevicePlatform(): 'android' | 'ios' | 'web' {
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'web';
}

/**
 * Get a friendly device name
 */
function getDeviceName(): string {
  const ua = navigator.userAgent;
  // Try to extract browser name
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome Browser';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser';
  if (ua.includes('Edg')) return 'Edge Browser';
  return 'Web Browser';
}

/**
 * Register for push notifications.
 * Requests permission, gets FCM token, and registers it with the backend.
 * Returns true if successful, false if denied or unsupported.
 */
export async function registerForPushNotifications(): Promise<boolean> {
  try {
    const token = await requestPushPermission();
    if (!token) return false;

    // Check if we already registered this exact token
    const existingToken = localStorage.getItem(FCM_TOKEN_KEY);
    if (existingToken === token) {
      return true; // Already registered
    }

    // Register token with backend
    await api.post('/fcm-tokens', {
      token,
      device_name: getDeviceName(),
      platform: getDevicePlatform(),
    });

    localStorage.setItem(FCM_TOKEN_KEY, token);
    console.log('[Push] Device registered for push notifications');
    return true;
  } catch (err) {
    console.error('[Push] Failed to register for push notifications:', err);
    return false;
  }
}

/**
 * Unregister from push notifications.
 * Removes the FCM token from the backend and local storage.
 */
export async function unregisterFromPushNotifications(): Promise<void> {
  try {
    const token = localStorage.getItem(FCM_TOKEN_KEY);
    if (!token) return;

    await api.delete(`/fcm-tokens/${encodeURIComponent(token)}`);
    localStorage.removeItem(FCM_TOKEN_KEY);
    console.log('[Push] Device unregistered from push notifications');
  } catch (err) {
    console.error('[Push] Failed to unregister from push notifications:', err);
  }
}

/**
 * Check if push notifications are currently enabled for this device
 */
export function isPushEnabled(): boolean {
  return !!localStorage.getItem(FCM_TOKEN_KEY);
}

/**
 * Check if the browser supports push notifications
 */
export function isPushSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Get the current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Initialize foreground message handling.
 * Displays a toast/notification when a push arrives while the app is open.
 * Call this once after user authentication.
 */
export function initForegroundNotifications(
  onNotification?: (payload: { title: string; body: string; data?: Record<string, string> }) => void
): void {
  onForegroundMessage((payload) => {
    const title = payload.notification?.title || 'SoftAware';
    const body = payload.notification?.body || '';
    const data = payload.data || {};

    console.log('[Push] Foreground notification:', title, body);

    // Call custom handler if provided (for in-app toast)
    if (onNotification) {
      onNotification({ title, body, data });
    }

    // Also show a browser notification if the page isn't focused
    if (document.hidden && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo192.png',
      });
    }
  });
}

/**
 * Get FCM status from backend
 */
export async function getFcmStatus(): Promise<{ fcm_enabled: boolean }> {
  try {
    const res = await api.get('/fcm-tokens/status');
    return res.data?.data || { fcm_enabled: false };
  } catch {
    return { fcm_enabled: false };
  }
}

/**
 * List all registered devices for the current user
 */
export async function listRegisteredDevices(): Promise<any[]> {
  try {
    const res = await api.get('/fcm-tokens');
    return res.data?.data || [];
  } catch {
    return [];
  }
}
