import { supabase } from '@/integrations/supabase/client';
import { sendWhatsAppMessage, checkWhatsAppOptIn } from './whatsappHelpers';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'low_stock' | 'order_update' | 'return_update';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  read: boolean;
  action_url?: string;
  metadata?: any;
  created_at: string;
  expires_at?: string;
}

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string;
  metadata?: any;
  expiresInHours?: number;
  sendWhatsApp?: boolean;
  whatsAppPhone?: string;
  customerId?: string;
}

/**
 * Create a notification for a specific user
 */
export const createNotification = async ({
  userId,
  title,
  message,
  type,
  priority = 'normal',
  actionUrl,
  metadata = {},
  expiresInHours,
  sendWhatsApp = false,
  whatsAppPhone,
  customerId,
}: CreateNotificationParams): Promise<void> => {
  try {
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      title,
      message,
      type,
      priority,
      action_url: actionUrl,
      metadata,
      expires_at: expiresAt,
    });

    if (error) {
      console.error('Failed to create notification:', error);
    }

    // Send WhatsApp if requested
    if (sendWhatsApp && whatsAppPhone) {
      // Check opt-in status if customerId provided
      let canSend = true;
      if (customerId) {
        canSend = await checkWhatsAppOptIn(customerId);
      }

      if (canSend) {
        await sendWhatsAppMessage({
          to: whatsAppPhone,
          message: `${title}\n\n${message}`
        });
      }
    }
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

/**
 * Create notifications for multiple users
 */
export const createBulkNotifications = async (
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> => {
  try {
    const expiresAt = params.expiresInHours
      ? new Date(Date.now() + params.expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const notifications = userIds.map((userId) => ({
      user_id: userId,
      title: params.title,
      message: params.message,
      type: params.type,
      priority: params.priority || 'normal',
      action_url: params.actionUrl,
      metadata: params.metadata || {},
      expires_at: expiresAt,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);

    if (error) {
      console.error('Failed to create bulk notifications:', error);
    }
  } catch (error) {
    console.error('Error creating bulk notifications:', error);
  }
};

/**
 * Mark a notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Failed to mark notification as read:', error);
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Mark all notifications as read for the current user
 */
export const markAllNotificationsAsRead = async (): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('mark_all_notifications_read', {
      p_user_id: user.id,
    });

    if (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

/**
 * Delete a notification
 */
export const deleteNotification = async (notificationId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Failed to delete notification:', error);
    }
  } catch (error) {
    console.error('Error deleting notification:', error);
  }
};

/**
 * Get unread notification count for current user
 */
export const getUnreadCount = async (): Promise<number> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};

// Notification templates for common scenarios
export const NotificationTemplates = {
  lowStock: (productName: string, currentStock: number, reorderLevel: number) => ({
    title: 'Low Stock Alert',
    message: `${productName} is running low. Current stock: ${currentStock} (Reorder level: ${reorderLevel})`,
    type: 'low_stock' as NotificationType,
    priority: 'high' as NotificationPriority,
  }),

  orderCreated: (orderNumber: string) => ({
    title: 'New Order',
    message: `Order #${orderNumber} has been created successfully`,
    type: 'order_update' as NotificationType,
    priority: 'normal' as NotificationPriority,
  }),

  orderDispatched: (orderNumber: string, courier: string) => ({
    title: 'Order Dispatched',
    message: `Order #${orderNumber} has been dispatched via ${courier}`,
    type: 'order_update' as NotificationType,
    priority: 'normal' as NotificationPriority,
  }),

  orderDelivered: (orderNumber: string) => ({
    title: 'Order Delivered',
    message: `Order #${orderNumber} has been successfully delivered`,
    type: 'success' as NotificationType,
    priority: 'low' as NotificationPriority,
  }),

  returnReceived: (orderNumber: string) => ({
    title: 'Return Received',
    message: `Return for order #${orderNumber} has been received`,
    type: 'return_update' as NotificationType,
    priority: 'normal' as NotificationPriority,
  }),

  orderAssigned: (orderNumber: string, staffName: string) => ({
    title: 'Order Assigned',
    message: `Order #${orderNumber} has been assigned to ${staffName}`,
    type: 'order_update' as NotificationType,
    priority: 'normal' as NotificationPriority,
  }),
};
