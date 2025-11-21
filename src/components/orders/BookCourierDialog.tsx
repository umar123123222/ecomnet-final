import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updateOrderStatus } from "@/utils/orderStatusManager";
import { Truck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface BookCourierDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BookCourierDialog({
  orderId,
  orderNumber,
  open,
  onOpenChange,
  onSuccess
}: BookCourierDialogProps) {
  const { toast } = useToast();
  const [courier, setCourier] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCouriers();
    }
  }, [open]);

  const fetchCouriers = async () => {
    const { data } = await supabase
      .from('couriers')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setCouriers(data);
    }
  };

  const handleBook = async () => {
    if (!courier) {
      toast({
        title: "Error",
        description: "Please select a courier",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      const result = await updateOrderStatus({
        orderId,
        newStatus: 'booked',
        userId: user?.id,
        courier,
        trackingId: trackingId || undefined,
        sendNotification: true
      });

      if (result.success) {
        toast({
          title: "Courier Booked",
          description: `Order #${orderNumber} booked with ${courier} and synced to Shopify`,
        });
        
        onOpenChange(false);
        onSuccess?.();
        
        // Reset form
        setCourier("");
        setTrackingId("");
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error booking courier:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to book courier",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            Book Courier
          </DialogTitle>
          <DialogDescription>
            Book a courier for order #{orderNumber}. This will update the status and sync to Shopify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="courier">Courier *</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger>
                <SelectValue placeholder="Select courier" />
              </SelectTrigger>
              <SelectContent>
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tracking">Tracking ID (Optional)</Label>
            <Input
              id="tracking"
              placeholder="Enter tracking number"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Can be added later if not available now
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleBook}
            disabled={loading || !courier}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking...
              </>
            ) : (
              <>
                <Truck className="mr-2 h-4 w-4" />
                Book Courier
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
