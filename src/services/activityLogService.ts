
import { supabase } from '@/integrations/supabase/client';

export interface ActivityLogData {
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
  ): Promise<ActivityLogData> {
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
    
    return {
      id: data.id,
      user_id: data.user_id,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      details: data.details,
      timestamp: data.created_at,
    };
  },

  async getActivityLogs(filters?: {
    userId?: string;
    entityType?: string;
    limit?: number;
  }): Promise<ActivityLogData[]> {
    let query = supabase
      .from('activity_logs')
      .select(`
        id,
        user_id,
        action,
        entity_type,
        entity_id,
        details,
        created_at
      `)
      .order('created_at', { ascending: false });

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
    
    return (data || []).map(log => ({
      id: log.id,
      user_id: log.user_id,
      action: log.action,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      details: log.details,
      timestamp: log.created_at,
    }));
  }
};
