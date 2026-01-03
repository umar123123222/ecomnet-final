import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, DollarSign, Clock, AlertTriangle } from "lucide-react";

interface AssignedInventoryMobileCardProps {
  item: any;
  getStockStatus: (item: any) => { label: string; variant: "default" | "secondary" | "destructive" };
}

export function AssignedInventoryMobileCard({ item, getStockStatus }: AssignedInventoryMobileCardProps) {
  const status = getStockStatus(item);
  const isProduct = !!item.product;
  const data = isProduct ? item.product : item.packaging_item;
  const inv = isProduct ? item.warehouseInventory : null;
  const currentStock = isProduct 
    ? (inv?.available_quantity ?? (inv ? inv.quantity - inv.reserved_quantity : 0)) 
    : (data?.current_stock || 0);
  const reorderLevel = data?.reorder_level || 0;
  const isLowStock = currentStock <= reorderLevel;

  return (
    <Card className={`transition-all active:scale-[0.98] ${isLowStock ? 'border-yellow-500/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{data?.name}</h3>
            <p className="text-xs text-muted-foreground font-mono">{data?.sku}</p>
          </div>
          <Badge variant={status.variant} className="ml-2 shrink-0 text-xs">
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1 mb-3">
          <Badge variant="outline" className="text-xs capitalize">
            {isProduct ? "Product" : data?.type}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Package className={`h-3.5 w-3.5 ${isLowStock ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-muted-foreground">Stock</p>
              <p className={`font-semibold ${isLowStock ? 'text-destructive' : ''}`}>
                {currentStock} / {reorderLevel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Unit Cost</p>
              <p className="font-semibold">PKR {item.unit_cost?.toFixed(0) || "0"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">MOQ</p>
              <p className="font-semibold">{item.minimum_order_quantity || 1}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div>
              <p className="text-muted-foreground">Lead Time</p>
              <p className="font-semibold">{item.lead_time_days || 7}d</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
