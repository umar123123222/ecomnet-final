
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details?: any;
  timestamp: string;
  user?: {
    name: string;
    email: string;
  };
}

export const activityLogService = {
  async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    details?: any
  ) {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getActivityLogs(filters?: {
    userId?: string;
    entityType?: string;
    limit?: number;
  }) {
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        user:users(name, email)
      `)
      .order('timestamp', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }

    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data as ActivityLog[];
  }
};
