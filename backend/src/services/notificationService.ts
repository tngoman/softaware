/**
 * Notification Service
 * Wrapper for creating notifications in the system
 */

import { createNotificationWithPush } from './firebaseService.js';

interface NotificationOptions {
  userId: string | number;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error'
    | 'case_created' | 'case_assigned' | 'case_updated' | 'case_update' | 'case_comment' | 'case_resolved' | 'case_deleted'
    | 'bug_created'  | 'bug_assigned'  | 'bug_updated'  | 'bug_comment'  | 'bug_resolved'  | 'bug_workflow'
    | 'system_alert';
  data?: Record<string, any>;
}

/**
 * Map case-specific notification types to database enum values
 */
function mapNotificationType(type: NotificationOptions['type']): 'info' | 'success' | 'warning' | 'error' {
  switch (type) {
    case 'case_created':
    case 'case_comment':
    case 'bug_created':
    case 'bug_comment':
    case 'bug_workflow':
      return 'info';
    case 'case_assigned':
    case 'case_updated':
    case 'case_update':
    case 'case_resolved':
    case 'bug_assigned':
    case 'bug_updated':
    case 'bug_resolved':
      return 'success';
    case 'case_deleted':
    case 'system_alert':
      return 'warning';
    default:
      return type as 'info' | 'success' | 'warning' | 'error';
  }
}

/**
 * Create a notification for a user
 */
export async function createNotification(options: NotificationOptions): Promise<void> {
  const { userId, title, message, type = 'info', data = {} } = options;
  
  // Preserve the original notification type in data for push notification routing
  // (e.g. 'case_created', 'case_assigned') while mapping to DB-safe enum for storage
  const pushData: Record<string, string> = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, String(v)])
  );
  // Set the notification_type so the service worker can route by category
  if (type && !pushData.type) {
    pushData.type = type;
  }

  await createNotificationWithPush(String(userId), {
    title,
    message,
    type: mapNotificationType(type),
    data: pushData,
  });
}
