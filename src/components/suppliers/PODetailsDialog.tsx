import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react";
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

  // Fetch GRN with discrepancies for this PO
  const { data: grnData } = useQuery({
    queryKey: ["po-grn-details", po.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goods_received_notes")
        .select(`
          id,
          grn_number,
          discrepancy_flag,
          status,
          notes,
          received_date,
          grn_items(
            id,
            quantity_expected,
            quantity_received,
            quantity_accepted,
            quantity_rejected,
            defect_type,
            quality_status,
            notes,
            products(name, sku),
            packaging_items(name, sku)
          )
        `)
        .eq("po_id", po.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!po.id,
  });

  const hasDiscrepancy = grnData?.discrepancy_flag;
  const discrepantItems = grnData?.grn_items?.filter(
    (item: any) => item.quantity_received !== item.quantity_expected || item.defect_type
  ) || [];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5" />
            Purchase Order: {po.po_number}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-4 pr-4">
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

            {/* Receiving Issues Section */}
            {grnData && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {hasDiscrepancy ? (
                      <>
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <h3 className="font-semibold text-yellow-700">Receiving Issues Detected</h3>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-green-700">Received Successfully</h3>
                      </>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground mb-2">
                    GRN: {grnData.grn_number} • Status: <Badge variant="outline">{grnData.status}</Badge>
                  </div>

                  {hasDiscrepancy && discrepantItems.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                      <p className="text-sm font-medium text-yellow-800 mb-2">Items with Issues:</p>
                      <div className="space-y-2">
                        {discrepantItems.map((item: any) => {
                          const name = item.products?.name || item.packaging_items?.name || "Unknown";
                          const variance = item.quantity_expected - item.quantity_received;
                          return (
                            <div key={item.id} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                              <span className="font-medium">{name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  Expected: {item.quantity_expected} | Received: {item.quantity_received}
                                </span>
                                {variance !== 0 && (
                                  <Badge variant={variance > 0 ? "destructive" : "default"}>
                                    {variance > 0 ? `-${variance}` : `+${Math.abs(variance)}`}
                                  </Badge>
                                )}
                                {item.defect_type && (
                                  <Badge variant="outline" className="bg-red-50 text-red-700">
                                    {item.defect_type.replace(/_/g, " ")}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {grnData.notes && (
                        <p className="text-sm text-yellow-700 mt-2 pt-2 border-t border-yellow-200">
                          <strong>Warehouse Notes:</strong> {grnData.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

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

            <Separator />

            {/* Items Table */}
            <div>
              <h3 className="font-semibold mb-3">Order Items ({items.length})</h3>
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
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
