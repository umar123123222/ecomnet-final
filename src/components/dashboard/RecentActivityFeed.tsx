import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package, RotateCcw, User, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export const RecentActivityFeed: React.FC = () => {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['recent-activities'],
    queryFn: async () => {
      // Fetch recent orders
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, status, created_at, customer_name')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent returns
      const { data: returns } = await supabase
        .from('returns')
        .select('id, tracking_id, return_status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // Fetch recent activity logs
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('id, action, created_at, entity_type, user_id')
        .order('created_at', { ascending: false })
        .limit(10);

      // Combine and sort activities
      const combined = [
        ...(orders?.map(o => ({
          id: o.id,
          type: 'order',
          title: `New Order: ${o.order_number}`,
          description: o.customer_name,
          status: o.status,
          timestamp: o.created_at,
        })) || []),
        ...(returns?.map(r => ({
          id: r.id,
          type: 'return',
          title: `Return: ${r.tracking_id}`,
          description: r.return_status,
          status: r.return_status,
          timestamp: r.created_at,
        })) || []),
        ...(logs?.map(l => ({
          id: l.id,
          type: 'activity',
          title: l.action.replace(/_/g, ' ').toUpperCase(),
          description: l.entity_type,
          status: l.action,
          timestamp: l.created_at,
        })) || []),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

      return combined;
    },
    refetchInterval: 120000, // Refresh every 2 minutes (reduced from 30s)
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'order':
        return <Package className="h-4 w-4" />;
      case 'return':
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      booked: 'bg-orange-100 text-orange-800',
      dispatched: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      in_transit: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {activities?.map((activity) => (
              <div
                key={`${activity.type}-${activity.id}`}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="p-2 rounded-full bg-primary/10 text-primary">
                  {getIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </p>
                </div>
                <Badge className={getStatusColor(activity.status)} variant="secondary">
                  {activity.status}
                </Badge>
              </div>
            ))}
            {(!activities || activities.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
