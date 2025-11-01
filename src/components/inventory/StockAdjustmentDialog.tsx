import { useState, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, TrendingUp, TrendingDown, Info } from "lucide-react";

const adjustmentSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  outlet_id: z.string().min(1, "Outlet is required"),
  adjustment_type: z.enum(["increase", "decrease"], {
    required_error: "Please select adjustment type",
  }),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  reason: z.string().trim().min(1, "Reason is required").max(500, "Reason must be less than 500 characters"),
});

type AdjustmentFormData = z.infer<typeof adjustmentSchema>;

interface StockAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  outlets: any[];
}

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  products,
  outlets,
}: StockAdjustmentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      product_id: "",
      outlet_id: "",
      adjustment_type: "increase",
      quantity: 1,
      reason: "",
    },
  });

  const adjustmentType = watch("adjustment_type");
  const selectedProductId = watch("product_id");
  const selectedOutletId = watch("outlet_id");
  const quantity = watch("quantity") || 0;

  // Fetch current stock for selected product and outlet
  const { data: currentInventory, isLoading: isLoadingInventory } = useQuery({
    queryKey: ["inventory-item", selectedProductId, selectedOutletId],
    queryFn: async () => {
      if (!selectedProductId || !selectedOutletId) return null;
      
      const { data, error } = await supabase
        .from("inventory")
        .select("quantity, available_quantity, reserved_quantity")
        .eq("product_id", selectedProductId)
        .eq("outlet_id", selectedOutletId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // No inventory record exists
        throw error;
      }
      return data;
    },
    enabled: !!selectedProductId && !!selectedOutletId,
  });

  const currentStock = currentInventory?.quantity || 0;
  const calculatedNewStock = adjustmentType === "increase" 
    ? currentStock + quantity 
    : currentStock - quantity;

  // Check if this is a large adjustment (>100 units or >50% change)
  const isLargeAdjustment = quantity > 100 || (currentStock > 0 && Math.abs(quantity / currentStock) > 0.5);

  const onSubmit = async (data: AdjustmentFormData) => {
    // Show confirmation for large adjustments
    if (isLargeAdjustment && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-stock", {
        body: {
          operation: "adjustStock",
          data: {
            productId: data.product_id,
            outletId: data.outlet_id,
            quantity: data.adjustment_type === "increase" ? data.quantity : -data.quantity,
            reason: data.reason,
          },
        },
      });

      if (error) throw error;

      const resultData = result as any;

      toast({
        title: "Stock Adjusted Successfully",
        description: `Stock ${data.adjustment_type === "increase" ? "increased" : "decreased"} from ${resultData.previousQuantity || currentStock} to ${resultData.newQuantity || calculatedNewStock} units`,
      });

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-item"] });
      reset();
      setShowConfirmation(false);
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to adjust stock",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset confirmation when dialog closes
  useEffect(() => {
    if (!open) {
      setShowConfirmation(false);
    }
  }, [open]);

  const selectedProduct = products?.find(p => p.id === selectedProductId);
  const selectedOutlet = outlets?.find(o => o.id === selectedOutletId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>
            {showConfirmation 
              ? "Please confirm this large stock adjustment"
              : "Increase or decrease stock quantity for a product"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!showConfirmation ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="product_id">Product *</Label>
                <Select
                  value={watch("product_id")}
                  onValueChange={(value) => setValue("product_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.product_id && (
                  <p className="text-sm text-destructive">{errors.product_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="outlet_id">Outlet *</Label>
                <Select
                  value={watch("outlet_id")}
                  onValueChange={(value) => setValue("outlet_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outlet" />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets?.map((outlet) => (
                      <SelectItem key={outlet.id} value={outlet.id}>
                        {outlet.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.outlet_id && (
                  <p className="text-sm text-destructive">{errors.outlet_id.message}</p>
                )}
              </div>

              {/* Current Stock Display */}
              {selectedProductId && selectedOutletId && (
                <Alert className="bg-muted">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {isLoadingInventory ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading current stock...
                      </span>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-semibold">Current Stock: {currentStock} units</p>
                        {currentInventory && (
                          <p className="text-xs text-muted-foreground">
                            Available: {currentInventory.available_quantity} | Reserved: {currentInventory.reserved_quantity}
                          </p>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
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
                    <SelectItem value="increase">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        Increase Stock
                      </div>
                    </SelectItem>
                    <SelectItem value="decrease">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        Decrease Stock
                      </div>
                    </SelectItem>
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

              {/* Calculated Result Preview */}
              {selectedProductId && selectedOutletId && quantity > 0 && !isLoadingInventory && (
                <Alert className={calculatedNewStock < 0 ? "border-destructive" : "border-primary"}>
                  <AlertDescription className="flex items-center justify-between">
                    <span className="font-medium">
                      New Stock: {calculatedNewStock} units
                    </span>
                    {calculatedNewStock < 0 && (
                      <span className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Will result in negative stock!
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="reason">Reason *</Label>
                <Textarea
                  id="reason"
                  {...register("reason")}
                  placeholder="Damaged goods, inventory count correction, etc."
                  rows={3}
                />
                {errors.reason && (
                  <p className="text-sm text-destructive">{errors.reason.message}</p>
                )}
              </div>
            </>
          ) : (
            // Confirmation screen
            <div className="space-y-4">
              <Alert className="border-warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <p className="font-semibold mb-2">Large Adjustment Detected</p>
                  <p className="text-sm">
                    You are about to {adjustmentType} stock by {quantity} units, which is a significant change.
                  </p>
                </AlertDescription>
              </Alert>

              <div className="space-y-2 p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Product:</span>
                  <span className="font-medium">{selectedProduct?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Outlet:</span>
                  <span className="font-medium">{selectedOutlet?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Current Stock:</span>
                  <span className="font-medium">{currentStock} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Adjustment:</span>
                  <span className={`font-medium ${adjustmentType === "increase" ? "text-success" : "text-destructive"}`}>
                    {adjustmentType === "increase" ? "+" : "-"}{quantity} units
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-semibold">New Stock:</span>
                  <span className="font-bold text-lg">{calculatedNewStock} units</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {showConfirmation ? (
              <>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                >
                  Go Back
                </Button>
                <Button type="submit" disabled={isSubmitting} variant="default">
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Adjustment
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => {
                  reset();
                  onOpenChange(false);
                }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || calculatedNewStock < 0}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLargeAdjustment ? "Continue" : "Adjust Stock"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
