import api from '../services/api';

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  data?: any;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Notification Model
 * Handles all notification-related operations
 */
export class NotificationModel {
  /**
   * Get all notifications for the current user
   */
  static async getNotifications(page: number = 1, limit: number = 10) {
    const response = await api.get<{
      success: boolean;
      message?: string;
      data: Notification[];
      unread_count: number;
    }>(`/notifications?limit=${limit}`);
    
    // Return structure compatible with both dropdown and notifications page
    return {
      notifications: response.data.data || [],
      pagination: {
        page: page,
        per_page: limit,
        total: response.data.data?.length || 0,
        total_pages: 1
      }
    };
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount() {
    const response = await api.get<{
      success: boolean;
      message: string;
      data: {
        count: number;
      };
    }>('/notifications/unread/count');
    return response.data.data.count;
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(notificationId: number) {
    const response = await api.put<{
      success: boolean;
      message: string;
    }>(`/notifications/${notificationId}/read`);
    return response.data;
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead() {
    const response = await api.put<{
      success: boolean;
      message: string;
    }>('/notifications/read-all');
    return response.data;
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId: number) {
    const response = await api.delete<{
      success: boolean;
      message: string;
    }>(`/notifications/${notificationId}`);
    return response.data;
  }
}
