import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['shopify-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopify_sync_log')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as SyncLog[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
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
      processing: "secondary",
      error: "destructive",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
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
          <button
            onClick={() => refetch()}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.status)}
                        <span className="text-sm font-medium">
                          {getSyncTypeLabel(log.sync_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(log.status)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {log.records_processed || 0}
                        {log.records_failed > 0 && ` (${log.records_failed} failed)`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(log.started_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};