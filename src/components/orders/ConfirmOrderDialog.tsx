import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ConfirmOrderDialogProps {
  orderId: string;
  orderNumber: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConfirmOrderDialog({
  orderId,
  orderNumber,
  open,
  onOpenChange,
  onSuccess
}: ConfirmOrderDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      
      // Update order status to 'confirmed'
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id || '00000000-0000-0000-0000-000000000000',
        entity_type: 'order',
        entity_id: orderId,
        action: 'order_confirmed',
        details: {
          status: 'confirmed',
          notes: notes,
          timestamp: new Date().toISOString()
        }
      });

      // Send notification
      if (user?.id) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'order_status',
          title: `Order #${orderNumber} confirmed`,
          message: 'Order confirmed and ready for processing',
          priority: 'high',
          metadata: {
            order_id: orderId,
            order_number: orderNumber,
            status: 'confirmed'
          }
        });
      }

      toast({
        title: "Order Confirmed",
        description: `Order #${orderNumber} has been confirmed and ready for processing`,
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error confirming order:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to confirm order",
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
            <CheckCircle className="h-5 w-5 text-green-500" />
            Confirm Order
          </DialogTitle>
          <DialogDescription>
            Confirm order #{orderNumber}. This will update the status and sync to Shopify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Confirmation Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this confirmation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
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
            onClick={handleConfirm}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm Order
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
