import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

const requirementSchema = z.object({
  packaging_item_id: z.string().min(1, "Packaging item is required"),
  variant_id: z.string().optional(),
  quantity_required: z.number().min(1, "Quantity must be at least 1"),
  is_required: z.boolean(),
  notes: z.string().optional(),
});

type RequirementFormData = z.infer<typeof requirementSchema>;

interface PackagingRequirementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
}

export function PackagingRequirementsDialog({ 
  open, 
  onOpenChange, 
  productId, 
  productName 
}: PackagingRequirementsDialogProps) {
  const queryClient = useQueryClient();

  const { data: packagingItems } = useQuery({
    queryKey: ['packaging-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: variants } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('is_active', true)
        .order('variant_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: existingRequirements } = useQuery({
    queryKey: ['packaging-requirements', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_packaging_requirements')
        .select(`
          *,
          packaging_items (name, sku),
          product_variants (variant_name)
        `)
        .eq('product_id', productId);
      if (error) throw error;
      return data;
    },
  });
  
  const { control, register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<RequirementFormData>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      packaging_item_id: '',
      variant_id: '',
      quantity_required: 1,
      is_required: true,
      notes: '',
    }
  });

  const onSubmit = async (data: RequirementFormData) => {
    try {
      const { error } = await supabase
        .from('product_packaging_requirements')
        .insert({
          product_id: productId,
          packaging_item_id: data.packaging_item_id,
          variant_id: data.variant_id || null,
          quantity_required: data.quantity_required,
          is_required: data.is_required,
          notes: data.notes || null,
        });
      
      if (error) throw error;
      toast.success("Packaging requirement added");
      queryClient.invalidateQueries({ queryKey: ['packaging-requirements', productId] });
      reset();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (requirementId: string) => {
    try {
      const { error } = await supabase
        .from('product_packaging_requirements')
        .delete()
        .eq('id', requirementId);
      
      if (error) throw error;
      toast.success("Requirement deleted");
      queryClient.invalidateQueries({ queryKey: ['packaging-requirements', productId] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Packaging Requirements for {productName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Existing Requirements */}
          {existingRequirements && existingRequirements.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Current Requirements</h3>
              <div className="space-y-2">
                {existingRequirements.map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{req.packaging_items?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.product_variants?.variant_name || 'All variants'} • 
                        Qty: {req.quantity_required} • 
                        {req.is_required ? 'Required' : 'Optional'}
                      </p>
                      {req.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{req.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(req.id)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add New Requirement */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <h3 className="text-sm font-medium">Add New Requirement</h3>
            
            <div className="space-y-2">
              <Label htmlFor="packaging_item_id">Packaging Item *</Label>
              <Controller
                name="packaging_item_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select packaging item" />
                    </SelectTrigger>
                    <SelectContent>
                      {packagingItems?.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.packaging_item_id && (
                <p className="text-sm text-destructive">{errors.packaging_item_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="variant_id">Variant (Optional - Leave empty for all)</Label>
              <Controller
                name="variant_id"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="All variants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All variants</SelectItem>
                      {variants?.map((variant) => (
                        <SelectItem key={variant.id} value={variant.id}>
                          {variant.variant_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity_required">Quantity Required *</Label>
              <Input
                id="quantity_required"
                type="number"
                min="1"
                {...register('quantity_required', { valueAsNumber: true })}
              />
              {errors.quantity_required && (
                <p className="text-sm text-destructive">{errors.quantity_required.message}</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Controller
                name="is_required"
                control={control}
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="is_required">Required for fulfillment</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                placeholder="Optional notes"
                {...register('notes')}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Requirement'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
