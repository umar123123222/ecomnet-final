import { useState, useEffect } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck, Package } from "lucide-react";
import { bookCourier } from "@/utils/courierHelpers";

interface NewDispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedOrderId?: string;
}

const NewDispatchDialog = ({ open, onOpenChange, preSelectedOrderId }: NewDispatchDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    order_id: preSelectedOrderId || "",
    tracking_id: "",
    courier: "" as "leopard" | "tcs" | "postex" | "other" | "",
    notes: "",
    dispatch_date: new Date().toISOString().split('T')[0],
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isBooking, setIsBooking] = useState(false);

  // Fetch pending orders
  const { data: pendingOrders = [], isLoading } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id, 
          order_number, 
          customer_name, 
          customer_phone, 
          customer_address, 
          city, 
          total_amount,
          status
        `)
        .in("status", ["pending", "address clear"])
        .is("dispatched_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch active couriers
  const { data: activeCouriers = [] } = useQuery({
    queryKey: ["active-couriers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("couriers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (preSelectedOrderId) {
      setFormData(prev => ({ ...prev, order_id: preSelectedOrderId }));
      const order = pendingOrders.find(o => o.id === preSelectedOrderId);
      setSelectedOrder(order);
    }
  }, [preSelectedOrderId, pendingOrders]);

  const handleOrderSelect = (orderId: string) => {
    const order = pendingOrders.find(o => o.id === orderId);
    setSelectedOrder(order);
    setFormData({ ...formData, order_id: orderId });
  };

  const handleBookAndDispatch = async () => {
    // Validation
    if (!formData.order_id || !formData.courier) {
      toast({
        title: "Validation Error",
        description: "Please select an order and courier",
        variant: "destructive",
      });
      return;
    }

    if (!selectedOrder) {
      toast({
        title: "Error",
        description: "Order details not found",
        variant: "destructive",
      });
      return;
    }

    // Only book with API for integrated couriers
    if (formData.courier === "other") {
      toast({
        title: "Manual Tracking Required",
        description: "Please enter tracking ID manually for this courier",
        variant: "destructive",
      });
      return;
    }

    setIsBooking(true);

    try {
      // Get courier details
      const courier = activeCouriers.find(c => c.code === formData.courier);
      if (!courier) {
        throw new Error("Courier not found");
      }

      // Prepare booking parameters
      const bookingParams = {
        orderId: formData.order_id,
        courierId: courier.id,
        pickupAddress: {
          name: "Your Business Name", // TODO: Get from business settings
          phone: "+92-300-1234567", // TODO: Get from business settings
          address: "Your Warehouse Address", // TODO: Get from business settings
          city: "Karachi", // TODO: Get from business settings
        },
        deliveryAddress: {
          name: selectedOrder.customer_name,
          phone: selectedOrder.customer_phone,
          address: selectedOrder.customer_address,
          city: selectedOrder.city,
        },
        weight: 1, // Default 1kg
        pieces: 1, // Default 1 piece
        codAmount: selectedOrder.total_amount,
        specialInstructions: formData.notes,
      };

      // Call booking API
      const result = await bookCourier(bookingParams);

      if (result.success && result.trackingId) {
        // Auto-fill tracking ID
        setFormData(prev => ({ ...prev, tracking_id: result.trackingId! }));
        
        toast({
          title: "Booking Successful",
          description: `Tracking ID: ${result.trackingId}`,
        });

        // Proceed with dispatch creation
        createDispatchMutation.mutate({
          ...formData,
          tracking_id: result.trackingId,
        });
      } else {
        throw new Error(result.error || "Booking failed");
      }
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsBooking(false);
    }
  };

  const createDispatchMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!data.courier) {
        throw new Error("Courier is required");
      }

      // Create dispatch record
      const { error: dispatchError } = await supabase
        .from("dispatches")
        .insert({
          order_id: data.order_id,
          tracking_id: data.tracking_id,
          courier: data.courier as "leopard" | "tcs" | "postex" | "other",
          notes: data.notes,
          dispatch_date: data.dispatch_date,
          status: "pending",
        });

      if (dispatchError) throw dispatchError;

      // Update order status to dispatched
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "dispatched",
          courier: data.courier as "leopard" | "tcs" | "postex" | "other",
          tracking_id: data.tracking_id,
          dispatched_at: new Date().toISOString(),
        })
        .eq("id", data.order_id);

      if (orderError) throw orderError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["pending-orders"] });
      toast({
        title: "Dispatch Created",
        description: "Order has been dispatched successfully.",
      });
      onOpenChange(false);
      setFormData({
        order_id: "",
        tracking_id: "",
        courier: "" as "leopard" | "tcs" | "postex" | "other" | "",
        notes: "",
        dispatch_date: new Date().toISOString().split('T')[0],
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.order_id || !formData.courier || !formData.tracking_id) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    createDispatchMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Create New Dispatch
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="max-h-[65vh] pr-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="order_id">Order * {pendingOrders.length > 0 && `(${pendingOrders.length} available)`}</Label>
                <Select
                  value={formData.order_id}
                  onValueChange={handleOrderSelect}
                  disabled={!!preSelectedOrderId || isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      isLoading ? "Loading orders..." : 
                      pendingOrders.length === 0 ? "No orders available" :
                      "Select an order"
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingOrders.length === 0 ? (
                      <SelectItem value="" disabled>No dispatchable orders found</SelectItem>
                    ) : (
                      pendingOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.order_number} - {order.customer_name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="courier">Courier *</Label>
                <Select
                  value={formData.courier}
                  onValueChange={(value: "leopard" | "tcs" | "postex" | "other") => setFormData({ ...formData, courier: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select courier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leopard">Leopard</SelectItem>
                    <SelectItem value="tcs">TCS</SelectItem>
                    <SelectItem value="postex">PostEx</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedOrder && formData.courier && formData.courier !== "other" && (
                <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                  <p className="font-semibold">Order Details</p>
                  <p>Customer: {selectedOrder.customer_name}</p>
                  <p>City: {selectedOrder.city}</p>
                  <p>Amount: Rs. {selectedOrder.total_amount?.toLocaleString()}</p>
                </div>
              )}

              {formData.courier === "other" ? (
                <div>
                  <Label htmlFor="tracking_id">Tracking ID *</Label>
                  <Input
                    id="tracking_id"
                    value={formData.tracking_id}
                    onChange={(e) => setFormData({ ...formData, tracking_id: e.target.value })}
                    placeholder="Enter tracking number manually"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="tracking_id">Tracking ID</Label>
                  <Input
                    id="tracking_id"
                    value={formData.tracking_id}
                    placeholder="Will be auto-generated after booking"
                    disabled
                    className="bg-muted"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="dispatch_date">Dispatch Date</Label>
                <Input
                  id="dispatch_date"
                  type="date"
                  value={formData.dispatch_date}
                  onChange={(e) => setFormData({ ...formData, dispatch_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add any additional notes..."
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t sticky bottom-0 bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            
            {formData.courier === "other" ? (
              <Button 
                type="submit" 
                disabled={createDispatchMutation.isPending}
              >
                {createDispatchMutation.isPending ? "Creating..." : "Create Dispatch"}
              </Button>
            ) : (
              <Button 
                type="button"
                onClick={handleBookAndDispatch}
                disabled={isBooking || !formData.order_id || !formData.courier}
                className="bg-primary"
              >
                {isBooking ? (
                  <>
                    <Truck className="mr-2 h-4 w-4 animate-pulse" />
                    Booking...
                  </>
                ) : (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Book & Dispatch
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewDispatchDialog;