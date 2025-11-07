import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, RefreshCw, Search, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

interface MissingOrder {
  id: string;
  order_number: string;
  shopify_order_id: number | null;
  detected_at: string;
  synced_at: string | null;
  sync_status: string;
  error_message: string | null;
  detection_method: string;
}

export function MissingOrdersSync() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [orderNumbers, setOrderNumbers] = useState("");
  const [missingOrders, setMissingOrders] = useState<MissingOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMissingOrders();
  }, []);

  const loadMissingOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('missing_orders_log')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMissingOrders(data || []);
    } catch (error: any) {
      console.error('Error loading missing orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!orderNumbers.trim()) {
      toast({
        title: "Input Required",
        description: "Please enter order numbers to sync",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      // Parse order numbers - support comma-separated, space-separated, or newline-separated
      const numbers = orderNumbers
        .split(/[\s,\n]+/)
        .map(n => n.trim())
        .filter(n => n.length > 0);

      console.log('Syncing orders:', numbers);

      const { data, error } = await supabase.functions.invoke('sync-missing-orders', {
        body: { orderNumbers: numbers }
      });

      if (error) throw error;

      toast({
        title: "Sync Complete",
        description: data.message || `Synced ${data.results?.synced?.length || 0} orders`,
      });

      // Clear input and reload missing orders
      setOrderNumbers("");
      await loadMissingOrders();

    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync orders",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const syncPendingOrders = async () => {
    const pending = missingOrders.filter(o => o.sync_status === 'pending');
    
    if (pending.length === 0) {
      toast({
        title: "No Pending Orders",
        description: "All missing orders have been synced or failed",
      });
      return;
    }

    setSyncing(true);
    try {
      const numbers = pending.map(o => o.order_number);

      const { data, error } = await supabase.functions.invoke('sync-missing-orders', {
        body: { orderNumbers: numbers }
      });

      if (error) throw error;

      toast({
        title: "Sync Complete",
        description: data.message || `Synced ${data.results?.synced?.length || 0} orders`,
      });

      await loadMissingOrders();

    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync orders",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced':
        return <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Synced
        </Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" /> Failed
        </Badge>;
      case 'syncing':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" /> Syncing
        </Badge>;
      default:
        return <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Pending
        </Badge>;
    }
  };

  const pendingCount = missingOrders.filter(o => o.sync_status === 'pending').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <div>
              <CardTitle className="text-lg">Missing Orders Sync</CardTitle>
              <CardDescription>
                Manually sync orders that were not received via webhooks
              </CardDescription>
            </div>
          </div>
          {pendingCount > 0 && (
            <Badge variant="secondary">{pendingCount} Pending</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Manual Sync Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Enter Order Numbers</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., SHOP-318907, SHOP-318908, SHOP-318910"
              value={orderNumbers}
              onChange={(e) => setOrderNumbers(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSync} 
              disabled={syncing || !orderNumbers.trim()}
            >
              {syncing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Sync Orders
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Separate multiple order numbers with commas, spaces, or new lines
          </p>
        </div>

        {/* Quick Sync Detected Missing Orders */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-900">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                {pendingCount} missing {pendingCount === 1 ? 'order' : 'orders'} detected
              </p>
              <p className="text-xs text-muted-foreground">
                These orders have gaps in the sequence and need to be synced
              </p>
            </div>
            <Button 
              size="sm" 
              onClick={syncPendingOrders}
              disabled={syncing}
            >
              Sync All Pending
            </Button>
          </div>
        )}

        {/* Missing Orders Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Detected Missing Orders</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={loadMissingOrders}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : missingOrders.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p>No missing orders detected</p>
              <p className="text-xs mt-1">All orders are in sequence</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detection Method</TableHead>
                    <TableHead>Detected At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-mono">{order.order_number}</TableCell>
                      <TableCell>{getStatusBadge(order.sync_status)}</TableCell>
                      <TableCell className="capitalize text-sm">
                        {order.detection_method.replace('_', ' ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(order.detected_at), 'MMM dd, HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
