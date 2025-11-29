import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const variantSchema = z.object({
  variant_name: z.string().min(1, "Variant name is required"),
  variant_type: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  barcode: z.string().optional(),
  price_adjustment: z.number(),
  cost_adjustment: z.number(),
});

type VariantFormData = z.infer<typeof variantSchema>;

interface ProductVariantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  variant?: any;
}

export function ProductVariantDialog({ 
  open, 
  onOpenChange, 
  productId, 
  productName,
  variant 
}: ProductVariantDialogProps) {
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<VariantFormData>({
    resolver: zodResolver(variantSchema),
    defaultValues: variant ? {
      variant_name: variant.variant_name,
      variant_type: variant.variant_type || '',
      sku: variant.sku,
      barcode: variant.barcode || '',
      price_adjustment: variant.price_adjustment || 0,
      cost_adjustment: variant.cost_adjustment || 0,
    } : {
      variant_name: '',
      variant_type: '',
      sku: '',
      barcode: '',
      price_adjustment: 0,
      cost_adjustment: 0,
    }
  });

  const onSubmit = async (data: VariantFormData) => {
    try {
      if (variant) {
        const { error } = await supabase
          .from('product_variants')
          .update(data)
          .eq('id', variant.id);
        
        if (error) throw error;
        toast.success("Variant updated successfully");
      } else {
        const { error } = await supabase
          .from('product_variants')
          .insert([{
            variant_name: data.variant_name,
            variant_type: data.variant_type,
            sku: data.sku,
            barcode: data.barcode,
            price_adjustment: data.price_adjustment,
            cost_adjustment: data.cost_adjustment,
            product_id: productId,
          }]);
        
        if (error) throw error;
        toast.success("Variant created successfully");
      }
      
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {variant ? 'Edit' : 'Add'} Variant for {productName}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="variant_name">Variant Name *</Label>
            <Input
              id="variant_name"
              placeholder="e.g., 50ml, Red, Small"
              {...register('variant_name')}
            />
            {errors.variant_name && (
              <p className="text-sm text-destructive">{errors.variant_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="variant_type">Variant Type</Label>
            <Select onValueChange={(value) => setValue('variant_type', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="color">Color</SelectItem>
                <SelectItem value="material">Material</SelectItem>
                <SelectItem value="flavor">Flavor</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              placeholder="Unique SKU"
              {...register('sku')}
            />
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcode">Barcode</Label>
            <Input
              id="barcode"
              placeholder="Optional barcode"
              {...register('barcode')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price_adjustment">Price Adjustment</Label>
              <Input
                id="price_adjustment"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('price_adjustment', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_adjustment">Cost Adjustment</Label>
              <Input
                id="cost_adjustment"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('cost_adjustment', { valueAsNumber: true })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : variant ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
