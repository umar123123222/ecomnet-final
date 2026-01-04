import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { 
  FileText, Eye, AlertTriangle, Check, X, Truck, 
  Clock, Package, DollarSign, CreditCard, CheckCircle2,
  ChevronRight, Calendar, Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PODetailsDialog } from "./PODetailsDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrency } from "@/hooks/useCurrency";

interface SupplierPurchaseOrdersProps {
  supplierId: string;
}

export function SupplierPurchaseOrders({ supplierId }: SupplierPurchaseOrdersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { formatCurrency } = useCurrency();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; po: any } | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [deliveryCharges, setDeliveryCharges] = useState("");
  const [paymentConfirmNotes, setPaymentConfirmNotes] = useState("");

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ["supplier-purchase-orders", supplierId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          outlet:outlets(name),
          purchase_order_items(
            id,
            quantity_ordered,
            quantity_received,
            unit_price,
            total_price,
            product_id,
            products(name, sku),
            packaging_item_id,
            packaging_items(name, sku)
          )
        `)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data.map((po: any) => {
        const items = po.purchase_order_items || [];
        const totalOrdered = items.reduce((sum: number, item: any) => sum + (item.quantity_ordered || 0), 0);
        const totalReceived = items.reduce((sum: number, item: any) => sum + (item.quantity_received || 0), 0);
        const variance = totalOrdered - totalReceived;
        const hasVariance = variance !== 0 && totalReceived > 0;
        
        return {
          ...po,
          totalOrdered,
          totalReceived,
          variance,
          hasVariance
        };
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (data: { id: string; delivery_date: string; notes?: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          supplier_confirmed: true,
          supplier_confirmed_at: new Date().toISOString(),
          supplier_delivery_date: data.delivery_date,
          supplier_notes: data.notes,
          status: "confirmed",
        })
        .eq("id", data.id);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-po-lifecycle-email', {
          body: {
            po_id: data.id,
            notification_type: 'confirmed',
            additional_data: {
              delivery_date: data.delivery_date,
              notes: data.notes
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      toast({ title: "Order confirmed successfully" });
      setActionDialog(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error confirming order", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (data: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          supplier_rejected: true,
          supplier_rejected_reason: data.reason,
          status: "supplier_rejected",
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
      toast({ title: "Order rejected" });
      setActionDialog(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error rejecting order", description: error.message, variant: "destructive" });
    },
  });

  const shipMutation = useMutation({
    mutationFn: async (data: { id: string; tracking: string; notes?: string; deliveryCharges: number }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          shipped_at: new Date().toISOString(),
          shipping_tracking: data.tracking,
          supplier_notes: data.notes,
          shipping_cost: data.deliveryCharges,
          status: "in_transit",
        })
        .eq("id", data.id);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-po-lifecycle-email', {
          body: {
            po_id: data.id,
            notification_type: 'shipped',
            additional_data: {
              tracking: data.tracking,
              shipping_cost: data.deliveryCharges,
              notes: data.notes
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send shipping email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] });
      toast({ title: "Order marked as shipped" });
      setActionDialog(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error updating order", description: error.message, variant: "destructive" });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (data: { id: string; notes?: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          supplier_payment_confirmed: true,
          supplier_payment_confirmed_at: new Date().toISOString(),
          supplier_payment_confirmed_notes: data.notes,
        })
        .eq("id", data.id);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-po-lifecycle-email', {
          body: {
            po_id: data.id,
            notification_type: 'supplier_payment_confirmation',
            additional_data: {
              notes: data.notes
            }
          }
        });
      } catch (emailError) {
        console.error('Failed to send payment confirmation email:', emailError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-purchase-orders"] });
      toast({ title: "Payment receipt confirmed successfully" });
      setActionDialog(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error confirming payment", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setDeliveryDate("");
    setRejectReason("");
    setTrackingNumber("");
    setSupplierNotes("");
    setDeliveryCharges("");
    setPaymentConfirmNotes("");
  };

  const getStatusBadge = (po: any) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
      pending: { variant: 'secondary', label: 'Awaiting Response' },
      sent: { variant: 'outline', label: 'Sent' },
      confirmed: { variant: 'default', label: 'Confirmed' },
      supplier_rejected: { variant: 'destructive', label: 'Rejected' },
      in_transit: { variant: 'default', label: 'In Transit', className: 'bg-blue-500' },
      partially_received: { variant: 'outline', label: 'Partial' },
      completed: { variant: 'default', label: 'Completed', className: 'bg-green-500' },
      cancelled: { variant: 'destructive', label: 'Cancelled' },
      draft: { variant: 'secondary', label: 'Draft' },
    };
    
    const config = statusConfig[po.status];
    if (config) {
      return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
    }
    return <Badge variant="secondary">{po.status?.toUpperCase() || 'Unknown'}</Badge>;
  };

  const pendingPOs = purchaseOrders?.filter((po: any) => 
    po.status === "pending" && !po.supplier_confirmed && !po.supplier_rejected
  ).length || 0;
  const confirmedPOs = purchaseOrders?.filter((po: any) => po.status === "confirmed" && !po.shipped_at).length || 0;
  const shippedPOs = purchaseOrders?.filter((po: any) => po.shipped_at).length || 0;
  const paidPOs = purchaseOrders?.filter((po: any) => 
    po.paid_amount && po.paid_amount > 0 && !po.supplier_payment_confirmed
  ).length || 0;

  // Mobile Card Component for PO
  const POCard = ({ po }: { po: any }) => {
    const isPending = po.status === "pending" && !po.supplier_confirmed && !po.supplier_rejected;
    const canShip = po.supplier_confirmed && !po.shipped_at && po.status !== "cancelled";
    const canConfirmPayment = po.paid_amount && po.paid_amount > 0 && !po.supplier_payment_confirmed;

    return (
      <Card 
        className={`p-4 space-y-3 rounded-xl transition-all ${
          po.hasVariance ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{po.po_number}</span>
              {getStatusBadge(po)}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(po.order_date).toLocaleDateString()}
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="shrink-0 rounded-lg"
            onClick={() => setSelectedPO(po)}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Outlet</p>
            <p className="font-medium truncate">{po.outlet?.name || "-"}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Items</p>
            <p className="font-medium">{po.totalOrdered} items</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="font-semibold">{formatCurrency(po.total_amount || 0)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Delivery</p>
            <p className="font-medium">
              {po.supplier_delivery_date 
                ? new Date(po.supplier_delivery_date).toLocaleDateString()
                : po.expected_delivery_date
                  ? new Date(po.expected_delivery_date).toLocaleDateString()
                  : "-"}
            </p>
          </div>
        </div>

        {/* Payment Status */}
        {(po.paid_amount > 0 || canConfirmPayment) && (
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Payment</span>
              {po.supplier_payment_confirmed ? (
                <Badge className="bg-green-500 text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Confirmed
                </Badge>
              ) : po.paid_amount > 0 ? (
                <Badge className="bg-purple-500 text-xs">
                  {formatCurrency(po.paid_amount || 0)}
                </Badge>
              ) : null}
            </div>
          </div>
        )}

        {/* Actions */}
        {(isPending || canShip || canConfirmPayment) && (
          <div className="flex gap-2 pt-2 border-t">
            {isPending && (
              <>
                <Button 
                  size="sm"
                  className="flex-1 rounded-lg bg-green-600 hover:bg-green-700"
                  onClick={() => setActionDialog({ type: "confirm", po })}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Confirm
                </Button>
                <Button 
                  size="sm"
                  variant="destructive"
                  className="flex-1 rounded-lg"
                  onClick={() => setActionDialog({ type: "reject", po })}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </>
            )}
            {canShip && (
              <Button 
                size="sm"
                variant="outline"
                className="flex-1 rounded-lg text-blue-600 border-blue-200"
                onClick={() => setActionDialog({ type: "ship", po })}
              >
                <Truck className="h-4 w-4 mr-1" />
                Mark Shipped
              </Button>
            )}
            {canConfirmPayment && (
              <Button 
                size="sm"
                variant="outline"
                className="flex-1 rounded-lg text-purple-600 border-purple-200"
                onClick={() => setActionDialog({ type: "confirm_payment", po })}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Confirm Payment
              </Button>
            )}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Summary Cards - Horizontal scroll on mobile */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        <ScrollArea className="w-full">
          <div className="flex gap-3 sm:grid sm:grid-cols-5 sm:gap-4 pb-2 sm:pb-0">
            {[
              { icon: Clock, label: "Pending Review", value: pendingPOs, color: "text-amber-600", bg: "bg-amber-500/10" },
              { icon: Check, label: "Confirmed", value: confirmedPOs, color: "text-green-600", bg: "bg-green-500/10" },
              { icon: Truck, label: "Shipped", value: shippedPOs, color: "text-blue-600", bg: "bg-blue-500/10" },
              { icon: CreditCard, label: "Payments to Confirm", value: paidPOs, color: "text-purple-600", bg: "bg-purple-500/10" },
              { icon: DollarSign, label: "Total Value", value: formatCurrency(purchaseOrders?.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0) || 0), color: "text-primary", bg: "bg-primary/10" },
            ].map((stat, idx) => (
              <Card key={idx} className="shrink-0 w-[150px] sm:w-auto p-3 sm:p-4 rounded-xl">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`p-2 rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                    <p className={`text-lg sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="sm:hidden" />
        </ScrollArea>
      </div>

      {/* Filter & Content */}
      <Card className="rounded-xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg sm:text-xl font-semibold">Purchase Orders</h2>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] rounded-lg">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="partially_received">Partially Received</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="supplier_rejected">Rejected</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Mobile: Card View */}
        {isMobile ? (
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : purchaseOrders?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No purchase orders found</div>
            ) : (
              purchaseOrders?.map((po: any) => (
                <POCard key={po.id} po={po} />
              ))
            )}
          </div>
        ) : (
          /* Desktop: Table View */
          <div className="p-4 sm:p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Outlet</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total Amount</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                  </TableRow>
                ) : purchaseOrders?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">No purchase orders found</TableCell>
                  </TableRow>
                ) : (
                  purchaseOrders?.map((po: any) => (
                    <TableRow key={po.id} className={po.hasVariance ? "bg-amber-50 dark:bg-amber-950/10" : ""}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell>{new Date(po.order_date).toLocaleDateString()}</TableCell>
                      <TableCell>{po.outlet?.name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{po.totalOrdered} items</Badge>
                      </TableCell>
                      <TableCell>PKR {po.total_amount?.toLocaleString()}</TableCell>
                      <TableCell>
                        {po.supplier_delivery_date 
                          ? new Date(po.supplier_delivery_date).toLocaleDateString()
                          : po.expected_delivery_date
                            ? new Date(po.expected_delivery_date).toLocaleDateString()
                            : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(po)}</TableCell>
                      <TableCell>
                        {po.paid_amount && po.paid_amount > 0 ? (
                          po.supplier_payment_confirmed ? (
                            <Badge className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Confirmed
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-500">
                              PKR {po.paid_amount?.toLocaleString()}
                            </Badge>
                          )
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setSelectedPO(po)} className="rounded-lg">
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {po.status === "pending" && !po.supplier_confirmed && !po.supplier_rejected && (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-green-600 rounded-lg"
                                onClick={() => setActionDialog({ type: "confirm", po })}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-destructive rounded-lg"
                                onClick={() => setActionDialog({ type: "reject", po })}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          
                          {po.supplier_confirmed && !po.shipped_at && po.status !== "cancelled" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-blue-600 rounded-lg"
                              onClick={() => setActionDialog({ type: "ship", po })}
                            >
                              <Truck className="h-4 w-4" />
                            </Button>
                          )}

                          {po.paid_amount && po.paid_amount > 0 && !po.supplier_payment_confirmed && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="text-purple-600 rounded-lg"
                              onClick={() => setActionDialog({ type: "confirm_payment", po })}
                            >
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* PO Details Dialog */}
      {selectedPO && (
        <PODetailsDialog
          po={selectedPO}
          supplierId={supplierId}
          onClose={() => setSelectedPO(null)}
        />
      )}

      {/* Confirm Sheet/Dialog */}
      <Sheet open={actionDialog?.type === "confirm"} onOpenChange={() => setActionDialog(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "rounded-t-2xl" : "sm:max-w-md"}>
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              Confirm Order
            </SheetTitle>
            <SheetDescription>
              Confirm {actionDialog?.po?.po_number} for {actionDialog?.po?.totalOrdered} items
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label>Expected Delivery Date *</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about this order..."
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
                className="rounded-lg min-h-[100px]"
              />
            </div>
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} className="rounded-lg w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => confirmMutation.mutate({
                id: actionDialog?.po?.id,
                delivery_date: deliveryDate,
                notes: supplierNotes,
              })}
              disabled={!deliveryDate || confirmMutation.isPending}
              className="rounded-lg bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            >
              {confirmMutation.isPending ? "Confirming..." : "Confirm Order"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reject Sheet/Dialog */}
      <Sheet open={actionDialog?.type === "reject"} onOpenChange={() => setActionDialog(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "rounded-t-2xl" : "sm:max-w-md"}>
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <X className="h-5 w-5 text-red-600" />
              </div>
              Reject Order
            </SheetTitle>
            <SheetDescription>
              Reject {actionDialog?.po?.po_number}?
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label>Reason for Rejection *</Label>
              <Textarea
                placeholder="Why are you rejecting this order?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="rounded-lg min-h-[120px]"
              />
            </div>
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} className="rounded-lg w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({
                id: actionDialog?.po?.id,
                reason: rejectReason,
              })}
              disabled={!rejectReason || rejectMutation.isPending}
              className="rounded-lg w-full sm:w-auto"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Order"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Ship Sheet/Dialog */}
      <Sheet open={actionDialog?.type === "ship"} onOpenChange={() => setActionDialog(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "rounded-t-2xl" : "sm:max-w-md"}>
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              Mark as Shipped
            </SheetTitle>
            <SheetDescription>
              Mark {actionDialog?.po?.po_number} as shipped
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="space-y-2">
              <Label>Delivery Charges *</Label>
              <Input
                type="number"
                placeholder="Enter delivery charges (0 if none)"
                value={deliveryCharges}
                onChange={(e) => setDeliveryCharges(e.target.value)}
                min="0"
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Tracking Number (Optional)</Label>
              <Input
                placeholder="Enter tracking number..."
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="rounded-lg"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Shipping notes..."
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
                className="rounded-lg min-h-[100px]"
              />
            </div>
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} className="rounded-lg w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={() => shipMutation.mutate({
                id: actionDialog?.po?.id,
                tracking: trackingNumber,
                notes: supplierNotes,
                deliveryCharges: parseFloat(deliveryCharges) || 0,
              })}
              disabled={deliveryCharges === "" || shipMutation.isPending}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
            >
              {shipMutation.isPending ? "Updating..." : "Mark as Shipped"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Confirm Payment Sheet/Dialog */}
      <Sheet open={actionDialog?.type === "confirm_payment"} onOpenChange={() => setActionDialog(null)}>
        <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "rounded-t-2xl" : "sm:max-w-md"}>
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-purple-600" />
              </div>
              Confirm Payment
            </SheetTitle>
            <SheetDescription>
              Confirm that you have received payment for {actionDialog?.po?.po_number}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-6">
            <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-700 dark:text-green-400">Payment Amount</span>
              </div>
              <p className="text-2xl font-bold text-green-600">
                PKR {actionDialog?.po?.paid_amount?.toLocaleString()}
              </p>
              {actionDialog?.po?.payment_date && (
                <p className="text-sm text-muted-foreground mt-1">
                  Paid on: {new Date(actionDialog.po.payment_date).toLocaleDateString()}
                </p>
              )}
              {actionDialog?.po?.payment_reference && (
                <p className="text-sm text-muted-foreground">
                  Reference: {actionDialog.po.payment_reference}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about this payment..."
                value={paymentConfirmNotes}
                onChange={(e) => setPaymentConfirmNotes(e.target.value)}
                className="rounded-lg min-h-[100px]"
              />
            </div>
          </div>
          <SheetFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setActionDialog(null)} className="rounded-lg w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              className="rounded-lg bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              onClick={() => confirmPaymentMutation.mutate({
                id: actionDialog?.po?.id,
                notes: paymentConfirmNotes,
              })}
              disabled={confirmPaymentMutation.isPending}
            >
              {confirmPaymentMutation.isPending ? "Confirming..." : "Confirm Payment Received"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
