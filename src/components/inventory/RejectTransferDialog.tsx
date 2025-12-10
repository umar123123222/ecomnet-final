import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";

interface RejectTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void>;
  transferId: string;
}

const REJECTION_REASONS = [
  { value: "insufficient_stock", label: "Insufficient stock at warehouse" },
  { value: "invalid_request", label: "Invalid or incomplete request" },
  { value: "duplicate_request", label: "Duplicate request" },
  { value: "outlet_closed", label: "Destination outlet temporarily closed" },
  { value: "priority_change", label: "Priority allocation to other outlet" },
  { value: "other", label: "Other reason" },
];

export function RejectTransferDialog({ open, onOpenChange, onConfirm, transferId }: RejectTransferDialogProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    const finalReason = selectedReason === "other" 
      ? customReason.trim() 
      : REJECTION_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;
    
    if (!finalReason) return;

    setIsSubmitting(true);
    try {
      await onConfirm(finalReason);
      onOpenChange(false);
      setSelectedReason("");
      setCustomReason("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = selectedReason && (selectedReason !== "other" || customReason.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Reject Transfer Request
          </DialogTitle>
          <DialogDescription>
            Please provide a reason for rejecting this transfer request. This will be visible to the requester.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Rejection Reason <span className="text-destructive">*</span></Label>
            <Select value={selectedReason} onValueChange={setSelectedReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedReason === "other" && (
            <div className="space-y-2">
              <Label htmlFor="custom-reason">Specify Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="custom-reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please provide a detailed reason..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm} 
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reject Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}