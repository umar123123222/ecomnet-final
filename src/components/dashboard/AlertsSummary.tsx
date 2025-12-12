import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, Info, ChevronRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  count: number;
  action?: string;
  actionUrl?: string;
}

export const AlertsSummary: React.FC = () => {
  const navigate = useNavigate();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const alerts: Alert[] = [];

      // Check low stock items - fetch and filter in JavaScript
      const { data: inventory } = await supabase
        .from('inventory')
        .select('id, available_quantity, product:products(name, reorder_level)');

      const lowStock = inventory?.filter(item => 
        item.available_quantity <= (item.product?.reorder_level || 10)
      ) || [];

      if (lowStock && lowStock.length > 0) {
        alerts.push({
          id: 'low-stock',
          type: 'critical',
          title: 'Low Stock Alert',
          description: `${lowStock.length} products need restocking`,
          count: lowStock.length,
          action: 'View Inventory',
          actionUrl: '/inventory',
        });
      }

      // Check pending orders
      const { data: pendingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'booked');

      if (pendingOrders && pendingOrders.length > 5) {
        alerts.push({
          id: 'pending-orders',
          type: 'warning',
          title: 'Pending Orders',
          description: `${pendingOrders.length} orders awaiting dispatch`,
          count: pendingOrders.length,
          action: 'View Orders',
          actionUrl: '/orders',
        });
      }

      // Check returns not received
      const { data: returnsNotReceived } = await supabase
        .from('returns')
        .select('id')
        .eq('return_status', 'in_transit');

      if (returnsNotReceived && returnsNotReceived.length > 0) {
        alerts.push({
          id: 'returns-transit',
          type: 'info',
          title: 'Returns in Transit',
          description: `${returnsNotReceived.length} returns awaiting receipt`,
          count: returnsNotReceived.length,
          action: 'View Returns',
          actionUrl: '/returns',
        });
      }

      // Check stock transfer requests
      const { data: pendingTransfers } = await supabase
        .from('stock_transfer_requests')
        .select('id')
        .eq('status', 'pending');

      if (pendingTransfers && pendingTransfers.length > 0) {
        alerts.push({
          id: 'stock-transfers',
          type: 'warning',
          title: 'Pending Stock Transfers',
          description: `${pendingTransfers.length} transfers need approval`,
          count: pendingTransfers.length,
          action: 'View Transfers',
          actionUrl: '/stock-transfer',
        });
      }

      return alerts;
    },
    refetchInterval: 300000, // Refresh every 5 minutes (reduced from 1 min)
  });

  const getIcon = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getBadgeVariant = (type: Alert['type']) => {
    switch (type) {
      case 'critical':
        return 'destructive';
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Alerts & Notifications
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
          <AlertCircle className="h-5 w-5" />
          Alerts & Notifications
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts?.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1">
                {getIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{alert.title}</p>
                    <Badge variant={getBadgeVariant(alert.type)} className="text-xs">
                      {alert.count}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {alert.description}
                  </p>
                </div>
              </div>
              {alert.action && alert.actionUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(alert.actionUrl!)}
                  className="ml-2"
                >
                  {alert.action}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          ))}
          {(!alerts || alerts.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              <Info className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">All systems normal</p>
              <p className="text-xs mt-1">No alerts at this time</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
