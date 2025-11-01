import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const packagingAdjustmentSchema = z.object({
  packaging_item_id: z.string().min(1, "Packaging item is required"),
  adjustment_type: z.enum(["increase", "decrease"], {
    required_error: "Please select adjustment type",
  }),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().trim().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
});

type PackagingAdjustmentFormData = z.infer<typeof packagingAdjustmentSchema>;

interface PackagingAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packagingItems: any[];
}

export function PackagingAdjustmentDialog({
  open,
  onOpenChange,
  packagingItems,
}: PackagingAdjustmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<PackagingAdjustmentFormData>({
    resolver: zodResolver(packagingAdjustmentSchema),
    defaultValues: {
      packaging_item_id: "",
      adjustment_type: "increase",
      quantity: 1,
      reason: "",
    },
  });

  const adjustmentType = watch("adjustment_type");
  const selectedPackagingId = watch("packaging_item_id");

  // Get current stock for selected packaging item
  const selectedPackaging = packagingItems?.find(item => item.id === selectedPackagingId);
  const currentStock = selectedPackaging?.current_stock || 0;

  const onSubmit = async (data: PackagingAdjustmentFormData) => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-stock", {
        body: {
          operation: "adjustPackagingStock",
          data: {
            packagingItemId: data.packaging_item_id,
            quantity: data.adjustment_type === "increase" ? data.quantity : -data.quantity,
            reason: data.reason,
          },
        },
      });

      if (error) throw error;

      const resultData = result as any;
      
      toast({
        title: "Success",
        description: `Packaging stock ${data.adjustment_type === "increase" ? "increased" : "decreased"} from ${resultData.previousQuantity || currentStock} to ${resultData.newQuantity || (currentStock + (data.adjustment_type === "increase" ? data.quantity : -data.quantity))}`,
      });

      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust packaging stock",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Packaging Stock Adjustment</DialogTitle>
          <DialogDescription>
            Increase or decrease packaging item stock quantity
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="packaging_item_id">Packaging Item *</Label>
            <Select
              value={watch("packaging_item_id")}
              onValueChange={(value) => setValue("packaging_item_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select packaging item" />
              </SelectTrigger>
              <SelectContent>
                {packagingItems?.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} ({item.sku}) - Current: {item.current_stock}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.packaging_item_id && (
              <p className="text-sm text-destructive">{errors.packaging_item_id.message}</p>
            )}
          </div>

          {selectedPackaging && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">
                <span className="font-semibold">Current Stock:</span> {currentStock} units
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="adjustment_type">Adjustment Type *</Label>
            <Select
              value={adjustmentType}
              onValueChange={(value) => setValue("adjustment_type", value as "increase" | "decrease")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase">Increase Stock</SelectItem>
                <SelectItem value="decrease">Decrease Stock</SelectItem>
              </SelectContent>
            </Select>
            {errors.adjustment_type && (
              <p className="text-sm text-destructive">{errors.adjustment_type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              {...register("quantity", { valueAsNumber: true })}
              placeholder="1"
            />
            {errors.quantity && (
              <p className="text-sm text-destructive">{errors.quantity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              {...register("reason")}
              placeholder="Received shipment, damaged items, usage correction, etc."
              rows={3}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Adjust Stock
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
