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

  const onSubmit = async (data: AdjustmentFormData) => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("manage-stock", {
        body: {
          action: "adjustStock",
          product_id: data.product_id,
          outlet_id: data.outlet_id,
          quantity: data.adjustment_type === "increase" ? data.quantity : -data.quantity,
          reason: data.reason,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Stock ${data.adjustment_type === "increase" ? "increased" : "decreased"} successfully`,
      });

      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      reset();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Stock Adjustment</DialogTitle>
          <DialogDescription>
            Increase or decrease stock quantity for a product
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              <p className="text-sm text-red-500">{errors.product_id.message}</p>
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
              <p className="text-sm text-red-500">{errors.outlet_id.message}</p>
            )}
          </div>

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
              <p className="text-sm text-red-500">{errors.adjustment_type.message}</p>
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
              <p className="text-sm text-red-500">{errors.quantity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              {...register("reason")}
              placeholder="Damaged goods, inventory count correction, etc."
              rows={3}
            />
            {errors.reason && (
              <p className="text-sm text-red-500">{errors.reason.message}</p>
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
