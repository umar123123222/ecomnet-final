import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { Loader2 } from "lucide-react";

interface SyncStats {
  pending: number;
  failed: number;
  lastSync: string | null;
  highPriority: number;
}

export function SyncStatusWidget() {
  const { toast } = useToast();
  const [stats, setStats] = useState<SyncStats>({
    pending: 0,
    failed: 0,
    lastSync: null,
    highPriority: 0
  });
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSyncStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchSyncStats, 30000);
    
    // Real-time subscription
    const channel = supabase
      .channel('sync-queue-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'sync_queue' }, 
        () => fetchSyncStats()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchSyncStats = async () => {
    try {
      // Get pending count
      const { count: pendingCount } = await supabase
        .from('sync_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get failed count (retry_count >= 5)
      const { count: failedCount } = await supabase
        .from('sync_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('retry_count', 5);

      // Get high priority count
      const { count: highPriorityCount } = await supabase
        .from('sync_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .in('priority', ['critical', 'high']);

      // Get last successful sync
      const { data: lastSyncData } = await supabase
        .from('sync_queue')
        .select('processed_at')
        .eq('status', 'completed')
        .order('processed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setStats({
        pending: pendingCount || 0,
        failed: failedCount || 0,
        lastSync: lastSyncData?.processed_at || null,
        highPriority: highPriorityCount || 0
      });
    } catch (error) {
      console.error('Error fetching sync stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('process-sync-queue');

      if (error) throw error;

      toast({
        title: "Sync Queue Processed",
        description: `Processed ${data.processed} items, ${data.failed} failed`,
      });

      fetchSyncStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process sync queue",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setProcessing(true);

      // Reset failed items to pending with reset retry count
      const { error } = await supabase
        .from('sync_queue')
        .update({ 
          status: 'pending', 
          retry_count: 0,
          error_message: null
        })
        .eq('status', 'failed')
        .gte('retry_count', 5);

      if (error) throw error;

      toast({
        title: "Failed Items Reset",
        description: "Failed sync items have been reset and will be retried",
      });

      fetchSyncStats();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to retry items",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Shopify Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Clock className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-lg font-bold">{stats.pending}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <Zap className="h-4 w-4 text-orange-500" />
            <div>
              <div className="text-xs text-muted-foreground">High Priority</div>
              <div className="text-lg font-bold text-orange-500">{stats.highPriority}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <div>
              <div className="text-xs text-muted-foreground">Failed</div>
              <div className="text-lg font-bold text-red-500">{stats.failed}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <div className="text-xs text-muted-foreground">Last Sync</div>
              <div className="text-xs font-medium">
                {stats.lastSync ? new Date(stats.lastSync).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {stats.failed > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600 dark:text-red-400">
              {stats.failed} sync operation{stats.failed > 1 ? 's' : ''} failed after retries
            </span>
          </div>
        )}

        {stats.highPriority > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Zap className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-orange-600 dark:text-orange-400">
              {stats.highPriority} high priority item{stats.highPriority > 1 ? 's' : ''} in queue
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleProcessQueue}
            disabled={processing || stats.pending === 0}
            size="sm"
            className="flex-1"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Process Now
              </>
            )}
          </Button>

          {stats.failed > 0 && (
            <Button
              onClick={handleRetryFailed}
              disabled={processing}
              size="sm"
              variant="outline"
            >
              Retry Failed
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
