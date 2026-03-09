import admin from 'firebase-admin';
import { env } from '../config/env.js';
import { db } from '../db/mysql.js';
import { getFirebaseConfig } from './credentialVault.js';

// ─── Firebase Admin SDK Initialization ─────────────────────────────
let firebaseInitialized = false;

async function initFirebase(): Promise<boolean> {
  if (firebaseInitialized) return true;

  // Try credential vault first, then fall back to env vars
  const config = await getFirebaseConfig();

  if (!config || !config.projectId || !config.clientEmail || !config.privateKey) {
    console.warn('[Firebase] FCM not configured – push notifications disabled. Store FIREBASE credentials in the credential vault or set env vars.');
    return false;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: config.privateKey,
      }),
    });
    firebaseInitialized = true;
    console.log('[Firebase] Admin SDK initialized successfully');
    return true;
  } catch (err) {
    console.error('[Firebase] Failed to initialize Admin SDK:', err);
    return false;
  }
}

// Attempt initialization at module load (non-blocking)
initFirebase();

/**
 * Check whether Firebase / FCM is operational
 */
export function isFirebaseEnabled(): boolean {
  return firebaseInitialized;
}

// ─── FCM Token Management ──────────────────────────────────────────

/**
 * Register (or update) an FCM device token for a user
 */
export async function registerFcmToken(
  userId: string,
  token: string,
  deviceName?: string,
  platform?: string,
): Promise<void> {
  // Upsert: if token already exists (maybe for same or different user), update it
  await db.execute(
    `INSERT INTO fcm_tokens (user_id, token, device_name, platform)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), device_name = VALUES(device_name),
       platform = VALUES(platform), updated_at = NOW()`,
    [userId, token, deviceName || null, platform || null],
  );
}

/**
 * Unregister an FCM device token
 */
export async function unregisterFcmToken(userId: string, token: string): Promise<void> {
  await db.execute(`DELETE FROM fcm_tokens WHERE user_id = ? AND token = ?`, [userId, token]);
}

/**
 * List all registered devices for a user
 */
export async function listFcmTokens(userId: string) {
  return db.query<{
    id: number;
    token: string;
    device_name: string | null;
    platform: string | null;
    created_at: string;
    updated_at: string;
  }>(`SELECT id, token, device_name, platform, created_at, updated_at FROM fcm_tokens WHERE user_id = ? ORDER BY updated_at DESC`, [userId]);
}

// ─── Push Notification Sending ─────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Optional notification image URL */
  imageUrl?: string;
}

/**
 * Send a push notification to ALL registered devices for a user.
 * Silently no-ops if FCM is not configured.
 * Automatically removes stale / unregistered tokens.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (!firebaseInitialized) return { sent: 0, failed: 0 };

  const devices = await db.query<{ id: number; token: string }>(
    `SELECT id, token FROM fcm_tokens WHERE user_id = ?`,
    [userId],
  );

  if (devices.length === 0) return { sent: 0, failed: 0 };

  const tokens = devices.map((d) => d.token);

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    data: payload.data || {},
    // Android-specific
    android: {
      priority: 'high',
      notification: {
        channelId: 'softaware_default',
        sound: 'default',
      },
    },
    // iOS-specific
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);

    // Clean up stale tokens
    const staleTokenIds: number[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        // These error codes indicate the token is no longer valid
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokenIds.push(devices[idx].id);
        }
      }
    });

    // Remove stale tokens from DB
    if (staleTokenIds.length > 0) {
      await db.execute(
        `DELETE FROM fcm_tokens WHERE id IN (${staleTokenIds.map(() => '?').join(',')})`,
        staleTokenIds,
      );
      console.log(`[Firebase] Removed ${staleTokenIds.length} stale FCM token(s) for user ${userId}`);
    }

    return {
      sent: response.successCount,
      failed: response.failureCount,
    };
  } catch (err) {
    console.error('[Firebase] Push notification error:', err);
    return { sent: 0, failed: tokens.length };
  }
}

/**
 * Send a push notification to multiple users at once
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map((uid) => sendPushToUser(uid, payload)));
}

/**
 * Helper: create an in-app notification AND send a push notification
 * This is the primary function to call when you want to notify a user.
 * Respects user's notification preferences (web_notifications_enabled, push_notifications_enabled).
 */
export async function createNotificationWithPush(
  userId: string,
  notification: {
    title: string;
    message: string;
    type?: string;
    data?: Record<string, string>;
  },
): Promise<void> {
  // Check user notification preferences
  const userPrefs = await db.queryOne<{
    notifications_enabled: boolean;
    web_notifications_enabled: boolean;
    push_notifications_enabled: boolean;
  }>(
    `SELECT notifications_enabled, web_notifications_enabled, push_notifications_enabled 
     FROM users WHERE id = ?`,
    [userId]
  );

  // If master notifications toggle is off, skip everything
  if (userPrefs && userPrefs.notifications_enabled === false) {
    console.log(`[Notifications] User ${userId} has notifications disabled — skipping`);
    return;
  }

  // 1. Insert in-app notification (only if web notifications enabled)
  if (!userPrefs || userPrefs.web_notifications_enabled !== false) {
    await db.execute(
      `INSERT INTO notifications (user_id, title, message, type, data, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, notification.title, notification.message, notification.type || 'info', notification.data ? JSON.stringify(notification.data) : null],
    );
  }

  // 2. Send push notification (fire & forget — only if push enabled)
  if (!userPrefs || userPrefs.push_notifications_enabled !== false) {
    sendPushToUser(userId, {
      title: notification.title,
      body: notification.message,
      data: {
        type: notification.type || 'info',
        ...(notification.data || {}),
      },
    }).catch((err) => {
      console.error('[Firebase] Background push failed:', err);
    });
  }
}
