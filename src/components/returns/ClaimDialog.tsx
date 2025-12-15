import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FileWarning } from 'lucide-react';

interface ClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    returnValue: number;
    trackingId: string | null;
    courier: string;
  };
  onSuccess: () => void;
}

const ClaimDialog = ({ open, onOpenChange, order, onSuccess }: ClaimDialogProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [claimReference, setClaimReference] = useState('');
  const [claimAmount, setClaimAmount] = useState(order.returnValue.toString());
  const [claimNotes, setClaimNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) {
      toast({ title: "Error", description: "You must be logged in", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Check if return record already exists for this order
      const { data: existingReturn, error: checkError } = await supabase
        .from('returns')
        .select('id')
        .eq('order_id', order.id)
        .maybeSingle();

      if (checkError) throw checkError;

      const claimData = {
        claimed_at: new Date().toISOString(),
        claimed_by: user.id,
        claim_amount: parseFloat(claimAmount) || order.returnValue,
        claim_status: 'pending',
        claim_reference: claimReference || null,
        claim_notes: claimNotes || null,
        return_status: 'claimed' as const,
      };

      if (existingReturn) {
        // Update existing return record
        const { error: updateError } = await supabase
          .from('returns')
          .update(claimData)
          .eq('id', existingReturn.id);

        if (updateError) throw updateError;
      } else {
        // Create new return record with claim
        const { error: insertError } = await supabase
          .from('returns')
          .insert({
            order_id: order.id,
            tracking_id: order.trackingId,
            worth: order.returnValue,
            reason: 'Lost/Stolen by courier - Claimed',
            ...claimData,
          });

        if (insertError) throw insertError;
      }

      // Update order status to 'returned'
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'returned',
          returned_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        entity_type: 'order',
        entity_id: order.id,
        action: 'claim_filed',
        details: {
          order_number: order.orderNumber,
          courier: order.courier,
          claim_amount: parseFloat(claimAmount),
          claim_reference: claimReference,
        }
      });

      toast({
        title: "Claim Filed",
        description: `Claim filed for ${order.orderNumber} - Amount: ₨${parseFloat(claimAmount).toLocaleString()}`,
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setClaimReference('');
      setClaimAmount(order.returnValue.toString());
      setClaimNotes('');
    } catch (error: any) {
      console.error('Error filing claim:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to file claim",
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
            <FileWarning className="h-5 w-5 text-amber-500" />
            File Courier Claim
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-muted/50 p-3 rounded-lg space-y-1">
            <p className="text-sm"><span className="text-muted-foreground">Order:</span> <span className="font-medium">{order.orderNumber}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{order.customerName}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Courier:</span> <span className="font-medium">{order.courier}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Tracking:</span> <span className="font-mono text-xs">{order.trackingId || 'N/A'}</span></p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimReference">Claim Reference # (Optional)</Label>
            <Input
              id="claimReference"
              placeholder="Courier ticket/claim number"
              value={claimReference}
              onChange={(e) => setClaimReference(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimAmount">Claim Amount (₨)</Label>
            <Input
              id="claimAmount"
              type="number"
              min="0"
              step="0.01"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Original order value: ₨{order.returnValue.toLocaleString()}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimNotes">Notes (Optional)</Label>
            <Textarea
              id="claimNotes"
              placeholder="Communication with courier, reason for claim, etc."
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-amber-600 hover:bg-amber-700">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Filing...
                </>
              ) : (
                'File Claim'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ClaimDialog;
