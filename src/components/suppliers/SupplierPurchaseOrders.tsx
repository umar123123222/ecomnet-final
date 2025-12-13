import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  FileText, Eye, AlertTriangle, Check, X, Truck, 
  Clock, Package, DollarSign 
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PODetailsDialog } from "./PODetailsDialog";

interface SupplierPurchaseOrdersProps {
  supplierId: string;
}

export function SupplierPurchaseOrders({ supplierId }: SupplierPurchaseOrdersProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<{ type: string; po: any } | null>(null);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [deliveryCharges, setDeliveryCharges] = useState("");

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

      // Trigger lifecycle email for confirmation
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

      // Trigger lifecycle email for shipping
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

  const resetForm = () => {
    setDeliveryDate("");
    setRejectReason("");
    setTrackingNumber("");
    setSupplierNotes("");
    setDeliveryCharges("");
  };

  const getStatusBadge = (po: any) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
      pending: { variant: 'secondary', label: 'Awaiting Your Response' },
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

  // Summary stats - pending POs now go directly to supplier
  const pendingPOs = purchaseOrders?.filter((po: any) => 
    po.status === "pending" && !po.supplier_confirmed && !po.supplier_rejected
  ).length || 0;
  const confirmedPOs = purchaseOrders?.filter((po: any) => po.status === "confirmed" && !po.shipped_at).length || 0;
  const shippedPOs = purchaseOrders?.filter((po: any) => po.shipped_at).length || 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingPOs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Check className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold text-green-600">{confirmedPOs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Shipped</p>
              <p className="text-2xl font-bold text-blue-600">{shippedPOs}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">
                PKR {(purchaseOrders?.reduce((sum: number, po: any) => sum + (po.total_amount || 0), 0) || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Purchase Orders</h2>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : purchaseOrders?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">No purchase orders found</TableCell>
              </TableRow>
            ) : (
              purchaseOrders?.map((po: any) => (
                <TableRow key={po.id} className={po.hasVariance ? "bg-yellow-50 dark:bg-yellow-950/10" : ""}>
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
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedPO(po)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {/* Show confirm/reject for pending orders (awaiting supplier response) */}
                      {po.status === "pending" && !po.supplier_confirmed && !po.supplier_rejected && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-green-600"
                            onClick={() => setActionDialog({ type: "confirm", po })}
                            title="Confirm Order"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="text-destructive"
                            onClick={() => setActionDialog({ type: "reject", po })}
                            title="Reject Order"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      
                      {/* Show ship button for confirmed orders */}
                      {po.supplier_confirmed && !po.shipped_at && po.status !== "cancelled" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="text-blue-600"
                          onClick={() => setActionDialog({ type: "ship", po })}
                        >
                          <Truck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* PO Details Dialog */}
      {selectedPO && (
        <PODetailsDialog
          po={selectedPO}
          supplierId={supplierId}
          onClose={() => setSelectedPO(null)}
        />
      )}

      {/* Confirm Dialog */}
      <Dialog open={actionDialog?.type === "confirm"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Purchase Order</DialogTitle>
            <DialogDescription>
              Confirm {actionDialog?.po?.po_number} for {actionDialog?.po?.totalOrdered} items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Expected Delivery Date *</Label>
              <Input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Any notes about this order..."
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              onClick={() => confirmMutation.mutate({
                id: actionDialog?.po?.id,
                delivery_date: deliveryDate,
                notes: supplierNotes,
              })}
              disabled={!deliveryDate || confirmMutation.isPending}
            >
              {confirmMutation.isPending ? "Confirming..." : "Confirm Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog?.type === "reject"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Purchase Order</DialogTitle>
            <DialogDescription>
              Reject {actionDialog?.po?.po_number}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for Rejection *</Label>
              <Textarea
                placeholder="Why are you rejecting this order?"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({
                id: actionDialog?.po?.id,
                reason: rejectReason,
              })}
              disabled={!rejectReason || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ship Dialog */}
      <Dialog open={actionDialog?.type === "ship"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Shipped</DialogTitle>
            <DialogDescription>
              Mark {actionDialog?.po?.po_number} as shipped
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Delivery Charges *</Label>
              <Input
                type="number"
                placeholder="Enter delivery charges (0 if none)"
                value={deliveryCharges}
                onChange={(e) => setDeliveryCharges(e.target.value)}
                min="0"
              />
            </div>
            <div>
              <Label>Tracking Number (Optional)</Label>
              <Input
                placeholder="Enter tracking number..."
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                placeholder="Shipping notes..."
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              onClick={() => shipMutation.mutate({
                id: actionDialog?.po?.id,
                tracking: trackingNumber,
                notes: supplierNotes,
                deliveryCharges: parseFloat(deliveryCharges) || 0,
              })}
              disabled={deliveryCharges === "" || shipMutation.isPending}
            >
              {shipMutation.isPending ? "Updating..." : "Mark as Shipped"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}