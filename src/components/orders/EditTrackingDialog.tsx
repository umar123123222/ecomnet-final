import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updateOrderTracking } from "@/utils/orderStatusManager";
import { Edit, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EditTrackingDialogProps {
  orderId: string;
  orderNumber: string;
  currentTrackingId?: string | null;
  currentCourier?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditTrackingDialog({
  orderId,
  orderNumber,
  currentTrackingId,
  currentCourier,
  open,
  onOpenChange,
  onSuccess
}: EditTrackingDialogProps) {
  const { toast } = useToast();
  const [courier, setCourier] = useState(currentCourier || "");
  const [trackingId, setTrackingId] = useState(currentTrackingId || "");
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCouriers();
      setTrackingId(currentTrackingId || "");
      setCourier(currentCourier || "");
    }
  }, [open, currentTrackingId, currentCourier]);

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

  const handleSave = async () => {
    if (!trackingId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a tracking ID",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      const result = await updateOrderTracking({
        orderId,
        trackingId: trackingId.trim(),
        courier: courier || undefined,
        userId: user?.id
      });

      if (result.success) {
        toast({
          title: "Tracking Updated",
          description: `Tracking ID updated to ${trackingId} and synced to Shopify`,
        });
        
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      console.error('Error updating tracking:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update tracking",
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
            <Edit className="h-5 w-5 text-primary" />
            Edit Tracking
          </DialogTitle>
          <DialogDescription>
            Update tracking information for order #{orderNumber}. Changes will sync to Shopify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="tracking">Tracking ID *</Label>
            <Input
              id="tracking"
              placeholder="Enter tracking number"
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="courier">Courier (Optional)</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger>
                <SelectValue placeholder="Keep current courier" />
              </SelectTrigger>
              <SelectContent>
                {couriers.map((c) => (
                  <SelectItem key={c.id} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave empty to keep current courier: {currentCourier || 'None'}
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
            onClick={handleSave}
            disabled={loading || !trackingId.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Edit className="mr-2 h-4 w-4" />
                Save Tracking
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
