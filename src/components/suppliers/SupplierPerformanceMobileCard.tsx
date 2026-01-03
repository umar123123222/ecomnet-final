import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Package, CheckCircle, XCircle, DollarSign, 
  TrendingUp, Clock, Truck, ChevronRight 
} from "lucide-react";

interface SupplierPerformanceMobileCardProps {
  order: {
    id: string;
    po_number: string;
    order_date: string;
    status: string;
    total_amount: number;
    items_ordered: number;
    items_received: number;
  };
}

export function SupplierPerformanceOrderCard({ order }: SupplierPerformanceMobileCardProps) {
  const fulfillment = order.items_ordered > 0 
    ? Math.round((order.items_received / order.items_ordered) * 100) 
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="transition-all active:scale-[0.98]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">{order.po_number}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(order.order_date).toLocaleDateString()}
            </p>
          </div>
          <Badge className={`text-xs ${getStatusColor(order.status)}`}>
            {order.status?.toUpperCase()}
          </Badge>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-muted-foreground">{order.items_ordered} items</span>
          <div className="flex-1 flex items-center gap-2">
            <Progress value={fulfillment} className="h-1.5 flex-1" />
            <span className="text-xs font-medium">{fulfillment}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount:</span>
          <span className="font-semibold">PKR {order.total_amount?.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface SupplierMetricsCardProps {
  metrics: {
    totalPOs: number;
    deliveredPOs: number;
    cancelledPOs: number;
    totalValue: number;
    fulfillmentRate: number;
    onTimeRate: number;
    avgLeadTime: number;
  };
}

export function SupplierMetricsCards({ metrics }: SupplierMetricsCardProps) {
  return (
    <div className="space-y-4">
      {/* Stats Row - Horizontally scrollable */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <Card className="p-3 shrink-0 min-w-[120px]">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Orders</p>
              <p className="text-lg font-bold">{metrics.totalPOs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shrink-0 min-w-[120px]">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Delivered</p>
              <p className="text-lg font-bold text-green-600">{metrics.deliveredPOs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shrink-0 min-w-[120px]">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Cancelled</p>
              <p className="text-lg font-bold text-destructive">{metrics.cancelledPOs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shrink-0 min-w-[120px]">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Value</p>
              <p className="text-lg font-bold">₨{(metrics.totalValue / 1000).toFixed(0)}k</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Fulfillment</span>
          </div>
          <Progress value={metrics.fulfillmentRate} className="h-1.5 mb-1" />
          <Badge 
            variant={metrics.fulfillmentRate >= 95 ? "default" : metrics.fulfillmentRate >= 80 ? "secondary" : "destructive"}
            className="text-xs w-full justify-center"
          >
            {metrics.fulfillmentRate.toFixed(0)}%
          </Badge>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">On-Time</span>
          </div>
          <Progress value={metrics.onTimeRate} className="h-1.5 mb-1" />
          <Badge 
            variant={metrics.onTimeRate >= 90 ? "default" : metrics.onTimeRate >= 70 ? "secondary" : "destructive"}
            className="text-xs w-full justify-center"
          >
            {metrics.onTimeRate.toFixed(0)}%
          </Badge>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Truck className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Lead Time</span>
          </div>
          <div className="text-center">
            <span className="text-xl font-bold">{metrics.avgLeadTime}</span>
            <span className="text-xs text-muted-foreground ml-1">days</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
