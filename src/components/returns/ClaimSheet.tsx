import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useCurrency } from '@/hooks/useCurrency';
import { Loader2, FileWarning, ShieldAlert, Truck, Package, User, Hash } from 'lucide-react';

interface ClaimSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    orderNumber: string;
    customerName: string;
    returnValue: number;
    trackingId: string | null;
    courier: string;
  } | null;
  onSuccess: () => void;
}

const ClaimSheet = ({ open, onOpenChange, order, onSuccess }: ClaimSheetProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { hasAnyRole } = useUserRoles();
  const { formatCurrency, currencySymbol } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [claimReference, setClaimReference] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  
  const canFileClaim = hasAnyRole(['super_admin', 'finance']);

  // Reset form when order changes
  useEffect(() => {
    if (order) {
      setClaimAmount(order.returnValue.toString());
      setClaimReference('');
      setClaimNotes('');
    }
  }, [order]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !order) {
      toast({ title: "Error", description: "Missing required data", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
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
        const { error: updateError } = await supabase
          .from('returns')
          .update(claimData)
          .eq('id', existingReturn.id);
        if (updateError) throw updateError;
      } else {
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

      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'returned',
          returned_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

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
        title: "Claim Filed Successfully",
        description: `Claim for ${order.orderNumber} - ${formatCurrency(parseFloat(claimAmount))}`,
      });

      onSuccess();
      onOpenChange(false);
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

  if (!order) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <FileWarning className="h-5 w-5 text-amber-500" />
            File Courier Claim
          </SheetTitle>
          <SheetDescription>
            Submit a claim for a return not received at warehouse
          </SheetDescription>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5 py-5">
          {/* Order Info Card */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Hash className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{order.orderNumber}</p>
                <p className="text-sm text-muted-foreground">Order Reference</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{order.customerName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>{order.courier}</span>
              </div>
              <div className="flex items-center gap-2 text-sm col-span-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-xs">{order.trackingId || 'N/A'}</span>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">Order Value</p>
              <p className="text-2xl font-bold text-foreground">₨{order.returnValue.toLocaleString()}</p>
            </div>
          </div>

          {!canFileClaim && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Only Super Admins and Finance users can file courier claims.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="claimReference">Claim Reference # (Optional)</Label>
            <Input
              id="claimReference"
              placeholder="Courier ticket or claim number"
              value={claimReference}
              onChange={(e) => setClaimReference(e.target.value)}
              disabled={!canFileClaim}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimAmount">Claim Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">{currencySymbol}</span>
              <Input
                id="claimAmount"
                type="number"
                min="0"
                step="0.01"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                required
                disabled={!canFileClaim}
                className="h-11 pl-8 text-lg font-semibold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="claimNotes">Notes (Optional)</Label>
            <Textarea
              id="claimNotes"
              placeholder="Communication with courier, reason for claim, additional details..."
              value={claimNotes}
              onChange={(e) => setClaimNotes(e.target.value)}
              rows={4}
              disabled={!canFileClaim}
              className="resize-none"
            />
          </div>

          <SheetFooter className="gap-2 pt-4 border-t sm:flex-row">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !canFileClaim} 
              className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Filing Claim...
                </>
              ) : (
                <>
                  <FileWarning className="h-4 w-4 mr-2" />
                  File Claim
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default ClaimSheet;
