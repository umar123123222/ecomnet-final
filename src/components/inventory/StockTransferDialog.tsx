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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const transferSchema = z.object({
  from_outlet_id: z.string().min(1, "Source outlet is required"),
  to_outlet_id: z.string().min(1, "Destination outlet is required"),
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
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Find main warehouse
  const mainWarehouse = outlets?.find(
    (outlet) => outlet.outlet_type === 'warehouse' && outlet.name.toLowerCase().includes('main')
  ) || outlets?.find((outlet) => outlet.outlet_type === 'warehouse');

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
      from_outlet_id: mainWarehouse?.id || "",
      to_outlet_id: "",
      notes: "",
    },
  });

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const newSelected = { ...prev };
      if (newSelected[productId]) {
        delete newSelected[productId];
      } else {
        newSelected[productId] = 1;
      }
      return newSelected;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: Math.max(1, quantity)
    }));
  };

  const onSubmit = async (data: TransferFormData) => {
    if (Object.keys(selectedProducts).length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const requests = Object.entries(selectedProducts).map(([productId, quantity]) =>
        supabase.functions.invoke("stock-transfer-request", {
          body: {
            action: "create",
            product_id: productId,
            from_outlet_id: data.from_outlet_id,
            to_outlet_id: data.to_outlet_id,
            quantity_requested: quantity,
            notes: data.notes,
          },
        })
      );

      const results = await Promise.all(requests);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error(`Failed to create ${errors.length} transfer request(s)`);
      }

      toast({
        title: "Success",
        description: `Created ${Object.keys(selectedProducts).length} stock transfer request(s)`,
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      reset();
      setSelectedProducts({});
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create transfer requests",
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
            <Label>Products * (Select one or more)</Label>
            <ScrollArea className="h-[200px] rounded-md border p-4">
              <div className="space-y-3">
                {products?.map((product) => (
                  <div key={product.id} className="flex items-start gap-3">
                    <Checkbox
                      id={product.id}
                      checked={!!selectedProducts[product.id]}
                      onCheckedChange={() => toggleProduct(product.id)}
                    />
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={product.id} className="cursor-pointer">
                        {product.name} ({product.sku})
                      </Label>
                      {selectedProducts[product.id] && (
                        <Input
                          type="number"
                          min="1"
                          value={selectedProducts[product.id]}
                          onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                          placeholder="Quantity"
                          className="w-24"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="from_outlet_id">From Outlet</Label>
            <Input
              value={mainWarehouse?.name || "Main Warehouse"}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Transfers are always from the main warehouse
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="to_outlet_id">To Outlet/Warehouse *</Label>
            <Select
              value={watch("to_outlet_id")}
              onValueChange={(value) => setValue("to_outlet_id", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select destination outlet or warehouse" />
              </SelectTrigger>
              <SelectContent>
                {outlets
                  ?.filter((outlet) => outlet.id !== mainWarehouse?.id)
                  ?.map((outlet) => (
                    <SelectItem key={outlet.id} value={outlet.id}>
                      {outlet.name} ({outlet.outlet_type === 'warehouse' ? 'Warehouse' : 'Outlet'})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {errors.to_outlet_id && (
              <p className="text-sm text-red-500">{errors.to_outlet_id.message}</p>
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
