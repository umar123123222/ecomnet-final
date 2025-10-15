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
import { Truck, Package } from "lucide-react";

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

  // Fetch pending orders
  const { data: pendingOrders = [], isLoading } = useQuery({
    queryKey: ["pending-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, status")
        .in("status", ["pending", "address clear"])
        .is("dispatched_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (preSelectedOrderId) {
      setFormData(prev => ({ ...prev, order_id: preSelectedOrderId }));
    }
  }, [preSelectedOrderId]);

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Create New Dispatch
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="order_id">Order * {pendingOrders.length > 0 && `(${pendingOrders.length} available)`}</Label>
            <Select
              value={formData.order_id}
              onValueChange={(value) => setFormData({ ...formData, order_id: value })}
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

          <div>
            <Label htmlFor="tracking_id">Tracking ID *</Label>
            <Input
              id="tracking_id"
              value={formData.tracking_id}
              onChange={(e) => setFormData({ ...formData, tracking_id: e.target.value })}
              placeholder="Enter tracking number"
            />
          </div>

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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createDispatchMutation.isPending}>
              {createDispatchMutation.isPending ? "Creating..." : "Create Dispatch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NewDispatchDialog;