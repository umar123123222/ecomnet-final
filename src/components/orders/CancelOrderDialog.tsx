import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  orderNumber?: string;
}

export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  orderNumber
}) => {
  const [reason, setReason] = useState('other');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      onOpenChange(false);
      setReason('other');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Order
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {orderNumber ? `Cancel order ${orderNumber}` : 'Cancel this order'}. This will cancel the order in both Ecomnet and Shopify.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cancellation-reason">Cancellation Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="cancellation-reason" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
                <SelectItem value="customer">Customer Request</SelectItem>
                <SelectItem value="fraud">Fraud</SelectItem>
                <SelectItem value="inventory">Inventory Unavailable</SelectItem>
                <SelectItem value="declined">Payment Declined</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Note:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>This action cannot be undone</li>
              <li>The order will be marked as cancelled in Shopify</li>
              <li>Inventory will not be automatically restocked</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Cancelling...' : 'Cancel Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
