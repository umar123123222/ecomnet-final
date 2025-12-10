import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle, Loader2, Package, PackageCheck, AlertTriangle, ArrowLeft } from "lucide-react";
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

const VARIANCE_REASONS = [
  { value: "damaged", label: "Damaged during transit" },
  { value: "missing", label: "Items missing from shipment" },
  { value: "short_shipment", label: "Short shipment from warehouse" },
  { value: "wrong_items", label: "Wrong items received" },
  { value: "packaging_damage", label: "Packaging damage (items intact)" },
  { value: "other", label: "Other" },
];

type ReceiveStep = "choice" | "details";

export const TransferReceiveDialog = ({ open, onOpenChange, transfer }: TransferReceiveDialogProps) => {
  const [step, setStep] = useState<ReceiveStep>("choice");
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>({});
  const [varianceReasons, setVarianceReasons] = useState<Record<string, string>>({});
  const [varianceNotes, setVarianceNotes] = useState<Record<string, string>>({});
  const [generalNotes, setGeneralNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const items = transfer?.items || [];

  // Initialize quantities when transfer changes
  const initializeQuantities = (complete: boolean) => {
    const quantities: Record<string, number> = {};
    items.forEach(item => {
      quantities[item.id] = complete ? item.quantity_approved : 0;
    });
    setReceivedQuantities(quantities);
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    const quantity = parseInt(value) || 0;
    setReceivedQuantities(prev => ({ ...prev, [itemId]: quantity }));
  };

  const handleVarianceReasonChange = (itemId: string, reason: string) => {
    setVarianceReasons(prev => ({ ...prev, [itemId]: reason }));
  };

  const handleVarianceNoteChange = (itemId: string, note: string) => {
    setVarianceNotes(prev => ({ ...prev, [itemId]: note }));
  };

  const calculateVariance = (itemId: string, expected: number) => {
    const received = receivedQuantities[itemId] ?? expected;
    return expected - received;
  };

  const hasVariances = () => {
    return items.some(item => {
      const variance = calculateVariance(item.id, item.quantity_approved);
      return variance !== 0;
    });
  };

  const handleReceivedComplete = async () => {
    if (!transfer) return;

    setIsSubmitting(true);
    try {
      const receiptItems = items.map(item => ({
        transfer_item_id: item.id,
        quantity_expected: item.quantity_approved,
        quantity_received: item.quantity_approved,
        variance_reason: null,
      }));

      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "receive",
          transfer_id: transfer.id,
          receipt_items: receiptItems,
          notes: "All items received complete",
        },
      });

      if (error) throw error;

      toast({
        title: "Transfer Received",
        description: "All items received successfully. Inventory has been updated.",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      handleClose();
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

  const handleMissingItems = () => {
    initializeQuantities(false);
    setStep("details");
  };

  const handleSubmitWithVariances = async () => {
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

    // Validate variance reasons and notes for items with variances
    const itemsWithVariances = items.filter(item => calculateVariance(item.id, item.quantity_approved) !== 0);
    const missingReasons = itemsWithVariances.filter(item => !varianceReasons[item.id]);
    if (missingReasons.length > 0) {
      toast({
        title: "Missing Variance Reasons",
        description: "Please select a reason for all items with variances",
        variant: "destructive",
      });
      return;
    }

    // Require notes for "other" reason
    const missingOtherNotes = itemsWithVariances.filter(
      item => varianceReasons[item.id] === "other" && !varianceNotes[item.id]?.trim()
    );
    if (missingOtherNotes.length > 0) {
      toast({
        title: "Missing Notes",
        description: "Please provide notes for items with 'Other' variance reason",
        variant: "destructive",
      });
      return;
    }

    if (!generalNotes.trim()) {
      toast({
        title: "Notes Required",
        description: "Please provide general notes explaining the variances",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const receiptItems = items.map(item => {
        const variance = calculateVariance(item.id, item.quantity_approved);
        const reasonKey = varianceReasons[item.id];
        const reasonLabel = VARIANCE_REASONS.find(r => r.value === reasonKey)?.label || reasonKey;
        const note = varianceNotes[item.id] || "";
        
        return {
          transfer_item_id: item.id,
          quantity_expected: item.quantity_approved,
          quantity_received: receivedQuantities[item.id],
          variance_reason: variance !== 0 
            ? `${reasonLabel}${note ? `: ${note}` : ""}`
            : null,
        };
      });

      const { error } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "receive",
          transfer_id: transfer.id,
          receipt_items: receiptItems,
          notes: generalNotes.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: "Transfer Received",
        description: "Transfer received with variances. Managers have been notified.",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      handleClose();
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

  const handleClose = () => {
    onOpenChange(false);
    setStep("choice");
    setReceivedQuantities({});
    setVarianceReasons({});
    setVarianceNotes({});
    setGeneralNotes("");
  };

  const totalExpected = items.reduce((sum, item) => sum + item.quantity_approved, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5" />
            Receive Transfer
          </DialogTitle>
          <DialogDescription>
            From {transfer?.from_outlet?.name} → {transfer?.to_outlet?.name}
          </DialogDescription>
        </DialogHeader>

        {step === "choice" ? (
          <div className="space-y-6 py-6">
            {/* Summary Card */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Expected Items</p>
                    <p className="text-sm text-muted-foreground">
                      {items.length} products • {totalExpected} total units
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Choice Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleReceivedComplete}
                disabled={isSubmitting}
                className="group relative p-6 rounded-xl border-2 border-green-200 hover:border-green-400 bg-green-50/50 hover:bg-green-50 transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-green-100 text-green-600 group-hover:bg-green-200 transition-colors">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-green-800">Received Complete</h3>
                    <p className="text-sm text-green-700 mt-1">
                      All items received as expected. No missing or damaged items.
                    </p>
                  </div>
                </div>
                {isSubmitting && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
                    <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                  </div>
                )}
              </button>

              <button
                onClick={handleMissingItems}
                disabled={isSubmitting}
                className="group p-6 rounded-xl border-2 border-yellow-200 hover:border-yellow-400 bg-yellow-50/50 hover:bg-yellow-50 transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-full bg-yellow-100 text-yellow-600 group-hover:bg-yellow-200 transition-colors">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-yellow-800">Missing / Damaged Items</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      Some items are missing, damaged, or quantities don't match.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("choice")}
              className="gap-2 -ml-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to options
            </Button>

            {/* Items Table */}
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right w-24">Expected</TableHead>
                    <TableHead className="text-right w-28">Received</TableHead>
                    <TableHead className="text-center w-24">Variance</TableHead>
                    <TableHead className="w-44">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const variance = calculateVariance(item.id, item.quantity_approved);
                    const hasVariance = variance !== 0;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product?.name}</p>
                            <p className="text-xs text-muted-foreground">{item.product?.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.quantity_approved}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max={item.quantity_approved}
                            value={receivedQuantities[item.id] ?? ""}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            className="w-20 text-right"
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {item.id in receivedQuantities && (
                            <Badge 
                              variant={variance > 0 ? "destructive" : variance < 0 ? "default" : "secondary"}
                              className="gap-1"
                            >
                              {variance > 0 ? (
                                <>
                                  <AlertCircle className="h-3 w-3" />
                                  -{variance}
                                </>
                              ) : variance < 0 ? (
                                <>+{Math.abs(variance)}</>
                              ) : (
                                <CheckCircle className="h-3 w-3" />
                              )}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasVariance && item.id in receivedQuantities && (
                            <Select
                              value={varianceReasons[item.id] || ""}
                              onValueChange={(value) => handleVarianceReasonChange(item.id, value)}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select reason..." />
                              </SelectTrigger>
                              <SelectContent>
                                {VARIANCE_REASONS.map((reason) => (
                                  <SelectItem key={reason.value} value={reason.value}>
                                    {reason.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Variance Notes for "Other" reasons */}
            {Object.entries(varianceReasons)
              .filter(([_, reason]) => reason === "other")
              .map(([itemId]) => {
                const item = items.find(i => i.id === itemId);
                return (
                  <div key={itemId} className="space-y-2">
                    <Label className="text-sm">
                      Notes for {item?.product?.name} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={varianceNotes[itemId] || ""}
                      onChange={(e) => handleVarianceNoteChange(itemId, e.target.value)}
                      placeholder="Explain the variance..."
                    />
                  </div>
                );
              })}

            <Separator />

            {/* General Notes */}
            <div className="space-y-2">
              <Label>
                General Notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Please explain the overall situation with this transfer (damaged packaging, missing items, etc.)..."
                rows={3}
              />
            </div>

            {/* Warning Banner */}
            {hasVariances() && (
              <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-4 border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Variances Detected</h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                      Management will be notified about these variances via portal notifications and email.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleSubmitWithVariances} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Receipt
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};