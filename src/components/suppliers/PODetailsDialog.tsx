import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, AlertTriangle, CheckCircle2, Calendar, Building2, Truck, Receipt } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";

interface PODetailsDialogProps {
  po: any;
  supplierId: string;
  onClose: () => void;
}

export function PODetailsDialog({ po, supplierId, onClose }: PODetailsDialogProps) {
  const items = po.purchase_order_items || [];
  const isMobile = useIsMobile();

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
            po_item_id,
            quantity_expected,
            quantity_received,
            quantity_accepted,
            quantity_rejected,
            unit_cost,
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

  // Mobile Item Card
  const ItemCard = ({ item }: { item: any }) => {
    const product = item.products || item.packaging_items;
    const variance = (item.quantity_ordered || 0) - (item.quantity_received || 0);
    
    return (
      <Card className="p-3 rounded-xl space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">{product?.name || "Unknown"}</p>
            <p className="text-xs text-muted-foreground">{product?.sku || "-"}</p>
          </div>
          <p className="font-semibold text-sm">PKR {item.total_price?.toLocaleString()}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-muted-foreground">Ordered</p>
            <p className="font-semibold">{item.quantity_ordered}</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${variance > 0 && item.quantity_received > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/50'}`}>
            <p className="text-muted-foreground">Received</p>
            <p className={`font-semibold ${variance > 0 && item.quantity_received > 0 ? 'text-red-600' : ''}`}>
              {item.quantity_received || 0}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-2 text-center">
            <p className="text-muted-foreground">Unit Price</p>
            <p className="font-semibold">PKR {item.unit_price?.toLocaleString()}</p>
          </div>
        </div>
        {variance > 0 && item.quantity_received > 0 && (
          <Badge variant="destructive" className="text-xs">-{variance} short</Badge>
        )}
      </Card>
    );
  };

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"} 
        className={`${isMobile ? "h-[90vh] rounded-t-2xl" : "sm:max-w-xl"} p-0 flex flex-col`}
      >
        <SheetHeader className="p-4 sm:p-6 pb-0 text-left shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-lg">{po.po_number}</span>
              <Badge 
                variant={po.status === "cancelled" ? "destructive" : "default"} 
                className="ml-2"
              >
                {po.status?.toUpperCase()}
              </Badge>
            </div>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6">
          <div className="space-y-4 pb-6">
            {/* Order Info Grid */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Card className="p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">Order Date</span>
                </div>
                <p className="font-medium text-sm">{new Date(po.order_date).toLocaleDateString()}</p>
              </Card>
              <Card className="p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="text-xs">Outlet</span>
                </div>
                <p className="font-medium text-sm truncate">{po.outlet?.name || "-"}</p>
              </Card>
              <Card className="p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Truck className="h-3.5 w-3.5" />
                  <span className="text-xs">Delivery</span>
                </div>
                <p className="font-medium text-sm">
                  {po.supplier_delivery_date 
                    ? new Date(po.supplier_delivery_date).toLocaleDateString()
                    : po.expected_delivery_date
                      ? new Date(po.expected_delivery_date).toLocaleDateString()
                      : "-"}
                </p>
              </Card>
              {po.shipped_at && (
                <Card className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-center gap-2 text-blue-600 mb-1">
                    <Truck className="h-3.5 w-3.5" />
                    <span className="text-xs">Shipped</span>
                  </div>
                  <p className="font-medium text-sm">{new Date(po.shipped_at).toLocaleDateString()}</p>
                </Card>
              )}
            </div>

            {po.shipping_tracking && (
              <Card className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Tracking Number</p>
                <p className="font-mono font-medium text-sm">{po.shipping_tracking}</p>
              </Card>
            )}

            <Separator />

            {/* Financial Summary */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold">Financial Summary</h3>
              </div>
              <Card className="p-4 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>PKR {(po.total_amount - (po.tax_amount || 0) - (po.shipping_cost || 0)).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>PKR {(po.tax_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>PKR {(po.shipping_cost || 0).toLocaleString()}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg">PKR {po.total_amount?.toLocaleString()}</span>
                </div>

                {/* Payment Breakdown */}
                {(po.paid_amount > 0 || grnData) && (() => {
                  const receivedTotal = grnData?.grn_items?.reduce((sum: number, item: any) => {
                    const unitCost = item.unit_cost || items.find((i: any) => i.id === item.po_item_id)?.unit_price || 0;
                    return sum + (item.quantity_received * unitCost);
                  }, 0) || 0;
                  const shippingCost = po.shipping_cost || 0;
                  const payableAmount = receivedTotal + shippingCost;
                  const amountDifference = po.total_amount - payableAmount;
                  const hasReceivingDifference = grnData && amountDifference > 0;

                  return (
                    <div className="mt-3 pt-3 border-t border-dashed space-y-2">
                      {grnData && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Received Value</span>
                            <span>PKR {receivedTotal.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm font-medium">
                            <span>Payable Amount</span>
                            <span>PKR {payableAmount.toLocaleString()}</span>
                          </div>
                        </>
                      )}
                      {po.paid_amount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Paid</span>
                          <span className="text-green-600 font-medium">PKR {po.paid_amount.toLocaleString()}</span>
                        </div>
                      )}
                      {hasReceivingDifference && (
                        <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
                          * Amount differs due to quantity variance
                        </p>
                      )}
                    </div>
                  );
                })()}
              </Card>
            </div>

            {/* Receiving Status */}
            {grnData && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    {hasDiscrepancy ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h3 className="font-semibold text-amber-700">Receiving Issues</h3>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <h3 className="font-semibold text-green-700">Received Successfully</h3>
                      </>
                    )}
                  </div>
                  
                  <Card className="p-3 rounded-xl bg-muted/30 mb-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>GRN: {grnData.grn_number}</span>
                      <Badge variant="outline">{grnData.status}</Badge>
                    </div>
                  </Card>

                  {hasDiscrepancy && discrepantItems.length > 0 && (
                    <Card className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 space-y-2">
                      <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Items with Issues:</p>
                      {discrepantItems.map((item: any) => {
                        const name = item.products?.name || item.packaging_items?.name || "Unknown";
                        const variance = item.quantity_expected - item.quantity_received;
                        return (
                          <div key={item.id} className="flex items-center justify-between text-sm bg-white dark:bg-background p-2 rounded-lg">
                            <span className="font-medium truncate">{name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              {variance !== 0 && (
                                <Badge variant={variance > 0 ? "destructive" : "default"} className="text-xs">
                                  {variance > 0 ? `-${variance}` : `+${Math.abs(variance)}`}
                                </Badge>
                              )}
                              {item.defect_type && (
                                <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">
                                  {item.defect_type.replace(/_/g, " ")}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {grnData.notes && (
                        <p className="text-sm text-amber-700 dark:text-amber-300 pt-2 border-t border-amber-200 dark:border-amber-800">
                          <strong>Notes:</strong> {grnData.notes}
                        </p>
                      )}
                    </Card>
                  )}
                </div>
              </>
            )}

            {/* Notes */}
            {(po.notes || po.supplier_notes) && (
              <>
                <Separator />
                <div className="space-y-3">
                  {po.notes && (
                    <Card className="p-3 rounded-xl bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-1">Order Notes</p>
                      <p className="text-sm">{po.notes}</p>
                    </Card>
                  )}
                  {po.supplier_notes && (
                    <Card className="p-3 rounded-xl bg-primary/5 border-primary/20">
                      <p className="text-xs text-primary mb-1">Your Notes</p>
                      <p className="text-sm">{po.supplier_notes}</p>
                    </Card>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Items */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Order Items ({items.length})
              </h3>
              
              {isMobile ? (
                <div className="space-y-2">
                  {items.map((item: any) => (
                    <ItemCard key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <Card className="rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Ordered</TableHead>
                        <TableHead className="text-right">Received</TableHead>
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
                            <TableCell className="text-muted-foreground">{product?.sku || "-"}</TableCell>
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
                </Card>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
