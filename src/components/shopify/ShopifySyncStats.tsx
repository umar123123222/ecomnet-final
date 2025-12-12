import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useEffect } from "react";

export const ShopifySyncStats = () => {
  const { data: stats, refetch } = useQuery({
    queryKey: ['shopify-sync-stats'],
    queryFn: async () => {
      // Get stats from last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setHours(oneDayAgo.getHours() - 24);

      const { data, error } = await supabase
        .from('shopify_sync_log')
        .select('status')
        .gte('started_at', oneDayAgo.toISOString());

      if (error) throw error;

      const total = data.length;
      const success = data.filter(log => log.status === 'success' || log.status === 'completed').length;
      const failed = data.filter(log => log.status === 'error' || log.status === 'failed').length;
      const processing = data.filter(log => log.status === 'processing').length;

      return { total, success, failed, processing };
    },
    refetchInterval: 120000, // Reduced from 30s to 2 minutes
  });

  const { data: queueStats, refetch: refetchQueue } = useQuery({
    queryKey: ['shopify-queue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_queue')
        .select('status')
        .in('status', ['pending', 'processing', 'failed']);

      if (error) throw error;

      const pending = data.filter(item => item.status === 'pending').length;
      const processing = data.filter(item => item.status === 'processing').length;
      const failed = data.filter(item => item.status === 'failed').length;

      return { pending, processing, failed };
    },
    refetchInterval: 120000, // Reduced from 30s
  });

  // Real-time updates for sync logs
  useEffect(() => {
    const channel = supabase
      .channel('sync-stats-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopify_sync_log'
        },
        () => {
          console.log('Sync log changed, refreshing stats');
          refetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sync_queue'
        },
        () => {
          console.log('Sync queue changed, refreshing stats');
          refetchQueue();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, refetchQueue]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Total Syncs (24h)
          </CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
          <p className="text-xs text-muted-foreground">
            Last 24 hours
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Successful
          </CardTitle>
          <CheckCircle2 className="h-4 w-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.success || 0}</div>
          <p className="text-xs text-muted-foreground">
            {stats?.total ? Math.round((stats.success / stats.total) * 100) : 0}% success rate
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Failed
          </CardTitle>
          <XCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats?.failed || 0}</div>
          <p className="text-xs text-muted-foreground">
            Requires attention
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Pending Queue
          </CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{queueStats?.pending || 0}</div>
          <p className="text-xs text-muted-foreground">
            {queueStats?.processing || 0} processing, {queueStats?.failed || 0} failed
          </p>
        </CardContent>
      </Card>
    </div>
  );
};