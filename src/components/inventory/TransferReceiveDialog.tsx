import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface TransferItem {
  id: string;
  product_id: string;
  quantity_approved: number;
  product?: {
    name: string;
    sku: string;
  };
}

interface TransferReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: {
    id: string;
    from_outlet?: { name: string };
    to_outlet?: { name: string };
    items?: TransferItem[];
  } | null;
}

export const TransferReceiveDialog = ({ open, onOpenChange, transfer }: TransferReceiveDialogProps) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [varianceReasons, setVarianceReasons] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const items = transfer?.items || [];

  const handleQuantityChange = (itemId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setReceivedQuantities(prev => ({ ...prev, [itemId]: quantity }));
  };

  const handleVarianceReasonChange = (itemId: string, reason: string) => {
    setVarianceReasons(prev => ({ ...prev, [itemId]: reason }));
  };

  const calculateVariance = (itemId: string, expected: number) => {
    const received = receivedQuantities[itemId] || 0;
    return expected - received;
  };

  const hasVariances = () => {
    return items.some(item => {
      const variance = calculateVariance(item.id, item.quantity_approved);
      return variance !== 0;
    });
  };

  const handleSubmit = async () => {
    if (!transfer) return;

    // Validate all quantities are entered
    const missingQuantities = items.filter(item => !(item.id in receivedQuantities));
    if (missingQuantities.length > 0) {
      toast({
        title: "Missing Quantities",
        description: "Please enter received quantities for all items",
        variant: "destructive",
      });
      return;
    }

    // Validate variance reasons for items with variances
    const itemsWithVariances = items.filter(item => calculateVariance(item.id, item.quantity_approved) !== 0);
    const missingReasons = itemsWithVariances.filter(item => !varianceReasons[item.id]?.trim());
    if (missingReasons.length > 0) {
      toast({
        title: "Missing Variance Reasons",
        description: "Please provide reasons for all items with variances",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare receipt items
      const receiptItems = items.map(item => ({
        transfer_item_id: item.id,
        quantity_expected: item.quantity_approved,
        quantity_received: receivedQuantities[item.id],
        variance_reason: varianceReasons[item.id] || null,
      }));

      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "receive",
          transfer_id: transfer.id,
          receipt_items: receiptItems,
          notes: notes.trim() || null,
        },
      });

      if (error) throw error;

      toast({
        title: "Transfer Received",
        description: hasVariances() 
          ? "Transfer received with variances. Managers have been notified."
          : "Transfer received successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onOpenChange(false);
      
      // Reset state
      setReceivedQuantities({});
      setVarianceReasons({});
      setNotes("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to receive transfer",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receive Transfer</DialogTitle>
          <DialogDescription>
            Record actual quantities received from {transfer?.from_outlet?.name} to {transfer?.to_outlet?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Reason (if variance)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const variance = calculateVariance(item.id, item.quantity_approved);
                  const hasVariance = variance !== 0 && item.id in receivedQuantities;

                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.product?.name}</div>
                          <div className="text-xs text-muted-foreground">{item.product?.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantity_approved}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="0"
                          value={receivedQuantities[item.id] || ""}
                          onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                          className="w-24 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {hasVariance && (
                          <Badge variant={variance > 0 ? "destructive" : "default"} className="gap-1">
                            {variance > 0 ? <AlertCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                            {variance > 0 ? `+${variance}` : variance}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasVariance && (
                          <Input
                            value={varianceReasons[item.id] || ""}
                            onChange={(e) => handleVarianceReasonChange(item.id, e.target.value)}
                            placeholder="Explain variance..."
                            className="min-w-[200px]"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-2">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional observations or comments..."
              rows={3}
            />
          </div>

          {hasVariances() && (
            <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Variances Detected</h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                    Super Admins, Super Managers, and Warehouse Managers will be notified about these variances via ERP notifications and email.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
