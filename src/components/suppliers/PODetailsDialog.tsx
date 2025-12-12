import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PODetailsDialogProps {
  po: any;
  supplierId: string;
  onClose: () => void;
}

export function PODetailsDialog({ po, supplierId, onClose }: PODetailsDialogProps) {
  const items = po.purchase_order_items || [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5" />
            Purchase Order: {po.po_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Order Details */}
          <div>
            <h3 className="font-semibold mb-2">Order Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Order Date:</div>
              <div>{new Date(po.order_date).toLocaleDateString()}</div>
              <div className="text-muted-foreground">Outlet:</div>
              <div>{po.outlet?.name || "-"}</div>
              <div className="text-muted-foreground">Status:</div>
              <div>
                <Badge variant={po.status === "cancelled" ? "destructive" : "default"}>
                  {po.status?.toUpperCase()}
                </Badge>
              </div>
              <div className="text-muted-foreground">Expected Delivery:</div>
              <div>
                {po.supplier_delivery_date 
                  ? new Date(po.supplier_delivery_date).toLocaleDateString()
                  : po.expected_delivery_date
                    ? new Date(po.expected_delivery_date).toLocaleDateString()
                    : "-"}
              </div>
              {po.shipped_at && (
                <>
                  <div className="text-muted-foreground">Shipped At:</div>
                  <div>{new Date(po.shipped_at).toLocaleDateString()}</div>
                </>
              )}
              {po.shipping_tracking && (
                <>
                  <div className="text-muted-foreground">Tracking:</div>
                  <div className="font-mono">{po.shipping_tracking}</div>
                </>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-2">Financial Summary</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Subtotal:</div>
              <div>PKR {(po.total_amount - (po.tax_amount || 0) - (po.shipping_cost || 0)).toLocaleString()}</div>
              <div className="text-muted-foreground">Tax:</div>
              <div>PKR {(po.tax_amount || 0).toLocaleString()}</div>
              <div className="text-muted-foreground">Shipping:</div>
              <div>PKR {(po.shipping_cost || 0).toLocaleString()}</div>
              <div className="text-muted-foreground font-semibold">Total:</div>
              <div className="font-bold">PKR {po.total_amount?.toLocaleString()}</div>
            </div>
          </div>

          {po.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Order Notes</h3>
                <p className="text-sm text-muted-foreground">{po.notes}</p>
              </div>
            </>
          )}

          {po.supplier_notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Your Notes</h3>
                <p className="text-sm text-muted-foreground">{po.supplier_notes}</p>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* Items Table */}
        <div>
          <h3 className="font-semibold mb-3">Order Items ({items.length})</h3>
          <ScrollArea className="h-[200px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Received</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any) => {
                  const product = item.products || item.packaging_items;
                  const variance = (item.quantity_ordered || 0) - (item.quantity_received || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{product?.name || "Unknown"}</TableCell>
                      <TableCell>{product?.sku || "-"}</TableCell>
                      <TableCell className="text-right">{item.quantity_ordered}</TableCell>
                      <TableCell className="text-right">
                        <span className={variance > 0 && item.quantity_received > 0 ? "text-destructive" : ""}>
                          {item.quantity_received || 0}
                        </span>
                        {variance > 0 && item.quantity_received > 0 && (
                          <Badge variant="destructive" className="ml-2 text-xs">-{variance}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">PKR {item.unit_price?.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-medium">PKR {item.total_price?.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
