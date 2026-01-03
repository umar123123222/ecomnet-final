import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  BarChart3, TrendingUp, Clock, CheckCircle, 
  XCircle, Package, Truck, DollarSign 
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { SupplierMetricsCards, SupplierPerformanceOrderCard } from "./SupplierPerformanceMobileCard";
import { useCurrency } from "@/hooks/useCurrency";
import { formatCurrency } from "@/utils/currency";

interface SupplierPerformanceProps {
  supplierId: string;
}

export function SupplierPerformance({ supplierId }: SupplierPerformanceProps) {
  const isMobile = useIsMobile();
  const { currency } = useCurrency();
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["supplier-performance", supplierId],
    queryFn: async () => {
      // Fetch all POs for this supplier
      const { data: pos, error: poError } = await supabase
        .from("purchase_orders")
        .select(`
          *,
          purchase_order_items(quantity_ordered, quantity_received, unit_price)
        `)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });

      if (poError) throw poError;

      // Calculate metrics
      const totalPOs = pos?.length || 0;
      const deliveredPOs = pos?.filter((po: any) => po.status === "delivered").length || 0;
      const cancelledPOs = pos?.filter((po: any) => po.status === "cancelled").length || 0;
      const onTimePOs = pos?.filter((po: any) => {
        if (po.status !== "delivered" || !po.received_at || !po.supplier_delivery_date) return false;
        return new Date(po.received_at) <= new Date(po.supplier_delivery_date);
      }).length || 0;

      // Calculate total value
      const totalValue = pos?.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0) || 0;

      // Calculate fulfillment rate (items received / items ordered)
      let totalOrdered = 0;
      let totalReceived = 0;
      pos?.forEach((po: any) => {
        po.purchase_order_items?.forEach((item: any) => {
          totalOrdered += item.quantity_ordered || 0;
          totalReceived += item.quantity_received || 0;
        });
      });
      const fulfillmentRate = totalOrdered > 0 ? (totalReceived / totalOrdered) * 100 : 0;

      // Calculate average lead time (days from order to delivery)
      const deliveredWithDates = pos?.filter((po: any) => 
        po.status === "delivered" && po.received_at && po.order_date
      ) || [];
      const totalLeadTime = deliveredWithDates.reduce((sum: number, po: any) => {
        const days = Math.ceil(
          (new Date(po.received_at).getTime() - new Date(po.order_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0);
      const avgLeadTime = deliveredWithDates.length > 0 
        ? Math.round(totalLeadTime / deliveredWithDates.length) 
        : 0;

      // Recent orders for history
      const recentOrders = pos?.slice(0, 10).map((po: any) => ({
        id: po.id,
        po_number: po.po_number,
        order_date: po.order_date,
        status: po.status,
        total_amount: po.total_amount,
        items_ordered: po.purchase_order_items?.reduce((sum: number, item: any) => sum + (item.quantity_ordered || 0), 0) || 0,
        items_received: po.purchase_order_items?.reduce((sum: number, item: any) => sum + (item.quantity_received || 0), 0) || 0,
      }));

      return {
        totalPOs,
        deliveredPOs,
        cancelledPOs,
        onTimePOs,
        totalValue,
        fulfillmentRate,
        avgLeadTime,
        onTimeRate: deliveredPOs > 0 ? (onTimePOs / deliveredPOs) * 100 : 0,
        recentOrders,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {isMobile ? (
          <div className="space-y-4">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-28 shrink-0 rounded-lg" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mobile view
  if (isMobile && metrics) {
    return (
      <div className="space-y-6">
        <SupplierMetricsCards metrics={metrics} />
        
        {/* Recent Orders */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Recent Orders
          </h3>
          {metrics.recentOrders?.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              No order history
            </Card>
          ) : (
            metrics.recentOrders?.map((order: any) => (
              <SupplierPerformanceOrderCard key={order.id} order={order} />
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <p className="text-2xl font-bold">{metrics?.totalPOs || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{metrics?.deliveredPOs || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-destructive/10 rounded-lg">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-bold text-destructive">{metrics?.cancelledPOs || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">{formatCurrency(metrics?.totalValue || 0, currency)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Indicators */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Fulfillment Rate</h3>
            </div>
            <Badge variant={metrics?.fulfillmentRate >= 95 ? "default" : metrics?.fulfillmentRate >= 80 ? "secondary" : "destructive"}>
              {metrics?.fulfillmentRate.toFixed(1)}%
            </Badge>
          </div>
          <Progress value={metrics?.fulfillmentRate || 0} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Percentage of ordered items successfully delivered
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">On-Time Delivery</h3>
            </div>
            <Badge variant={metrics?.onTimeRate >= 90 ? "default" : metrics?.onTimeRate >= 70 ? "secondary" : "destructive"}>
              {metrics?.onTimeRate.toFixed(1)}%
            </Badge>
          </div>
          <Progress value={metrics?.onTimeRate || 0} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            Orders delivered by promised date
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Avg Lead Time</h3>
            </div>
            <Badge variant="outline">
              {metrics?.avgLeadTime || 0} days
            </Badge>
          </div>
          <div className="text-3xl font-bold text-center py-2">
            {metrics?.avgLeadTime || 0}
            <span className="text-sm font-normal text-muted-foreground ml-1">days</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Average time from order to delivery
          </p>
        </Card>
      </div>

      {/* Order History */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Recent Order History</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Number</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Fulfillment</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics?.recentOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No order history</TableCell>
              </TableRow>
            ) : (
              metrics?.recentOrders?.map((order: any) => {
                const fulfillment = order.items_ordered > 0 
                  ? Math.round((order.items_received / order.items_ordered) * 100) 
                  : 0;
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.po_number}</TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                    <TableCell>{order.items_ordered} items</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={fulfillment} className="w-16 h-2" />
                        <span className="text-sm">{fulfillment}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatCurrency(order.total_amount || 0, currency)}</TableCell>
                    <TableCell>
                      <Badge variant={
                        order.status === "delivered" ? "default" :
                        order.status === "cancelled" ? "destructive" :
                        "secondary"
                      }>
                        {order.status?.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}