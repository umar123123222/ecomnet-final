import { supabase } from '@/integrations/supabase/client';

export type ActivityAction = 
  | 'order_created'
  | 'order_updated'
  | 'order_dispatched'
  | 'order_delivered'
  | 'return_created'
  | 'return_received'
  | 'address_verified'
  | 'customer_flagged'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted';

interface LogActivityParams {
  action: ActivityAction;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  userId?: string;
}

/**
 * Log an activity to the activity_logs table
 */
export const logActivity = async ({
  action,
  entityType,
  entityId,
  details = {},
  userId,
}: LogActivityParams): Promise<void> => {
  try {
    // Get current user if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id;
    }

    if (!currentUserId) {
      console.warn('No user ID available for activity logging');
      return;
    }

    const { error } = await supabase
      .from('activity_logs')
      .insert({
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
        user_id: currentUserId,
      });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

/**
 * Update user performance metrics
 */
export const updateUserPerformance = async (
  userId: string,
  metric: 'orders_processed' | 'returns_handled' | 'addresses_verified',
  increment: number = 1
): Promise<void> => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Check if record exists for today
    const { data: existing } = await supabase
      .from('user_performance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('user_performance')
        .update({
          [metric]: (existing[metric] || 0) + increment,
        })
        .eq('user_id', userId)
        .eq('date', today);

      if (error) throw error;
    } else {
      // Create new record
      const { error } = await supabase
        .from('user_performance')
        .insert({
          user_id: userId,
          date: today,
          [metric]: increment,
          orders_processed: metric === 'orders_processed' ? increment : 0,
          returns_handled: metric === 'returns_handled' ? increment : 0,
          addresses_verified: metric === 'addresses_verified' ? increment : 0,
        });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating user performance:', error);
  }
};

/**
 * Batch log activities for multiple entities
 */
export const batchLogActivities = async (
  activities: LogActivityParams[]
): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const records = activities.map(activity => ({
      action: activity.action,
      entity_type: activity.entityType,
      entity_id: activity.entityId,
      details: activity.details || {},
      user_id: activity.userId || user.id,
    }));

    const { error } = await supabase
      .from('activity_logs')
      .insert(records);

    if (error) {
      console.error('Failed to batch log activities:', error);
    }
  } catch (error) {
    console.error('Error batch logging activities:', error);
  }
};

/**
 * Get recent activities for a user
 */
export const getUserActivities = async (
  userId: string,
  limit: number = 50
) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return [];
  }
};

/**
 * Get activities for a specific entity
 */
export const getEntityActivities = async (
  entityType: string,
  entityId: string,
  limit: number = 50
) => {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select(`
        *,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching entity activities:', error);
    return [];
  }
};
