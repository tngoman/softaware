/**
 * Firebase Configuration
 * Client-side Firebase SDK setup for push notifications & analytics
 */
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';

// Firebase project configuration (from firebase.md)
const firebaseConfig = {
  apiKey: 'AIzaSyCvMx3rJgu5QgRU3LezBQ6lU-aoK25KsOM',
  authDomain: 'soft-aware.firebaseapp.com',
  projectId: 'soft-aware',
  storageBucket: 'soft-aware.firebasestorage.app',
  messagingSenderId: '765240677597',
  appId: '1:765240677597:web:fbccb98c6de81af16fb734',
  measurementId: 'G-0L7CEN7RN9',
};

// VAPID key for Web Push (from Firebase Console → Cloud Messaging → Web Push certificates)
const VAPID_KEY = 'BFOEsh3THfvgWiTDbsK5ecaDIVTXmfuJbubj_ev4x4OCfz8VB8Bl3SwjVfp8nxwRJd5hrjAs_qBaZ9EoA0Aw1WQ';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;

/**
 * Initialize Firebase Cloud Messaging (only in supported browsers)
 */
async function initMessaging(): Promise<Messaging | null> {
  if (messaging) return messaging;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Firebase] This browser does not support push notifications');
      return null;
    }
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.error('[Firebase] Failed to initialize messaging:', err);
    return null;
  }
}

/**
 * Request notification permission and get the FCM device token.
 * Returns null if permission denied or not supported.
 */
export async function requestPushPermission(): Promise<string | null> {
  try {
    const msg = await initMessaging();
    if (!msg) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Firebase] Notification permission denied');
      return null;
    }

    // Get the FCM token using our VAPID key
    const token = await getToken(msg, { vapidKey: VAPID_KEY });
    console.log('[Firebase] FCM token obtained');
    return token;
  } catch (err) {
    console.error('[Firebase] Error getting push token:', err);
    return null;
  }
}

/**
 * Listen for foreground push messages.
 * Call this once at app startup after the user is authenticated.
 */
export function onForegroundMessage(callback: (payload: any) => void): (() => void) | null {
  if (!messaging) {
    // Try to init synchronously — if already initialized, this is a no-op
    initMessaging().then((msg) => {
      if (msg) {
        onMessage(msg, callback);
      }
    });
    return null;
  }

  return onMessage(messaging, callback);
}

export { app as firebaseApp };
