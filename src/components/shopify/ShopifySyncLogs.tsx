import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface SyncLog {
  id: string;
  sync_type: string;
  sync_direction: string;
  status: string;
  records_processed: number;
  records_failed: number;
  error_details: any;
  started_at: string;
  completed_at: string;
  triggered_by: string;
}

export const ShopifySyncLogs = () => {
  const { toast } = useToast();
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['shopify-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching sync logs:', error);
        throw error;
      }
      return data as SyncLog[];
    },
    refetchInterval: 120000, // Reduced from 30s to 2 minutes
  });

  // Real-time updates for sync logs
  useEffect(() => {
    const channel = supabase
      .channel('sync-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopify_sync_log'
        },
        () => {
          console.log('New sync log entry, refreshing...');
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'in_progress':
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-primary animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      completed: "default",
      in_progress: "secondary",
      processing: "secondary",
      partial: "outline",
      error: "destructive",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getSyncTypeLabel = (syncType: string) => {
    const labels: Record<string, string> = {
      'order_create': 'Order Created',
      'order_update': 'Order Updated',
      'order_update_webhook': 'Order Update (Webhook)',
      'inventory_update': 'Inventory Updated',
      'inventory_update_webhook': 'Inventory Update (Webhook)',
      'product_create_webhook': 'Product Created (Webhook)',
      'product_update_webhook': 'Product Updated (Webhook)',
      'products': 'Products Sync',
      'orders': 'Orders Sync',
      'customers': 'Customers Sync',
      'full': 'Full Sync',
      'all': 'Full Sync',
    };

    return labels[syncType] || syncType;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Sync Activity Log</CardTitle>
            <CardDescription>
              Recent synchronization operations with Shopify
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const { data, error } = await supabase.functions.invoke('cancel-shopify-syncs', {
                  body: { status: 'in_progress' },
                });
                if (error) {
                  toast({ title: 'Cancel failed', description: String(error), variant: 'destructive' as any });
                } else {
                  toast({ title: 'Cancelled', description: `Cancelled ${data?.cancelled ?? 0} sync(s)` });
                  refetch();
                }
              }}
            >
              <XCircle className="h-4 w-4 mr-1" /> Cancel all
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {!logs || logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync logs found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Triggered By</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const duration = log.completed_at 
                    ? Math.round((new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()) / 1000)
                    : null;
                  
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className="text-sm font-medium">
                              {getSyncTypeLabel(log.sync_type)}
                            </span>
                          </div>
                          {log.error_details && (
                            <span className="text-xs text-destructive">
                              {typeof log.error_details === 'string' 
                                ? log.error_details 
                                : log.error_details.message || JSON.stringify(log.error_details)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {log.sync_direction || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">
                            ✓ {log.records_processed || 0}
                          </span>
                          {log.records_failed > 0 && (
                            <span className="text-xs text-destructive">
                              ✗ {log.records_failed} failed
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {duration !== null ? `${duration}s` : 'In progress...'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {log.triggered_by ? 'Admin User' : 'System'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};