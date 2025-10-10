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
import { useAuth } from "@/contexts/AuthContext";

const transferSchema = z.object({
  product_id: z.string().min(1, "Product is required"),
  from_outlet_id: z.string().min(1, "Source outlet is required"),
  to_outlet_id: z.string().min(1, "Destination outlet is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  notes: z.string().trim().max(500, "Notes must be less than 500 characters").optional(),
}).refine((data) => data.from_outlet_id !== data.to_outlet_id, {
  message: "Source and destination outlets must be different",
  path: ["to_outlet_id"],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface StockTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: any[];
  outlets: any[];
}

export function StockTransferDialog({
  open,
  onOpenChange,
  products,
  outlets,
}: StockTransferDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      product_id: "",
      from_outlet_id: "",
      to_outlet_id: "",
      quantity: 1,
      notes: "",
    },
  });

  const onSubmit = async (data: TransferFormData) => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("stock-transfer-request", {
        body: {
          action: "create",
          product_id: data.product_id,
          from_outlet_id: data.from_outlet_id,
          to_outlet_id: data.to_outlet_id,
          quantity_requested: data.quantity,
          notes: data.notes,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Stock transfer request created successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create transfer request",
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
          <DialogTitle>New Stock Transfer Request</DialogTitle>
          <DialogDescription>
            Request to transfer stock between outlets
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
            <Label htmlFor="from_outlet_id">From Outlet *</Label>
            <Select
              value={watch("from_outlet_id")}
              onValueChange={(value) => setValue("from_outlet_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select source outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets?.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.from_outlet_id && (
              <p className="text-sm text-red-500">{errors.from_outlet_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="to_outlet_id">To Outlet *</Label>
            <Select
              value={watch("to_outlet_id")}
              onValueChange={(value) => setValue("to_outlet_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination outlet" />
              </SelectTrigger>
              <SelectContent>
                {outlets?.map((outlet) => (
                  <SelectItem key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.to_outlet_id && (
              <p className="text-sm text-red-500">{errors.to_outlet_id.message}</p>
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes for this transfer"
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-500">{errors.notes.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
