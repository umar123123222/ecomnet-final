import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Clock, User } from 'lucide-react';

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  user: {
    full_name: string;
    email: string;
  } | null;
}

interface OrderActivityLogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderActivityLog({ orderId, open, onOpenChange }: OrderActivityLogProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'order')
        .eq('entity_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch user profiles separately
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(log => log.user_id))];
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        const userMap = new Map(users?.map(u => [u.id, u]) || []);
        
        const enrichedData = data.map(log => ({
          ...log,
          user: userMap.get(log.user_id) || null
        }));
        
        setActivities(enrichedData as ActivityLog[]);
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (open && orderId) {
      fetchActivities();
    }
  }, [open, orderId, fetchActivities]);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      order_created: 'Created',
      order_updated: 'Updated',
      order_dispatched: 'Dispatched',
      order_delivered: 'Delivered',
      order_assigned: 'Assigned',
      status_changed: 'Status Changed',
      verification_updated: 'Verification Updated',
      address_updated: 'Address Updated',
    };
    return labels[action] || action;
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      order_created: 'bg-green-500/10 text-green-500 border-green-500/20',
      order_updated: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      order_dispatched: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      order_delivered: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      order_assigned: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    };
    return colors[action] || 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order Activity Log</DialogTitle>
          <DialogDescription>
            Complete history of changes and updates to this order
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading activity log...</div>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">No activity logged yet</div>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="border rounded-lg p-4 space-y-3 bg-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Badge className={getActionColor(activity.action)}>
                        {getActionLabel(activity.action)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(activity.created_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {activity.user?.full_name || 'Unknown User'}
                    </span>
                    <span className="text-muted-foreground">
                      ({activity.user?.email})
                    </span>
                  </div>

                  {activity.details && Object.keys(activity.details).length > 0 && (
                    <div className="bg-muted/50 rounded p-3 text-sm space-y-1">
                      {Object.entries(activity.details).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium text-foreground capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-muted-foreground">
                            {typeof value === 'object' 
                              ? JSON.stringify(value) 
                              : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
