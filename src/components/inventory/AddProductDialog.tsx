import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const productSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(50, "SKU must be less than 50 characters"),
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  description: z.string().trim().max(1000, "Description must be less than 1000 characters").optional(),
  category: z.string().trim().max(100, "Category must be less than 100 characters").optional(),
  price: z.number().min(0, "Price must be positive"),
  cost: z.number().min(0, "Cost must be positive").optional(),
  reorder_level: z.number().int().min(0, "Reorder level must be a positive integer"),
  is_active: z.boolean(),
  size: z.string().optional(),
  unit_type: z.enum(['ml', 'grams', 'liters', 'kg', 'pieces', 'boxes']).optional(),
  requires_packaging: z.boolean().default(false),
  supplier_id: z.string().optional(),
  product_type: z.enum(['raw_material', 'finished', 'both']).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
}

export function AddProductDialog({ open, onOpenChange, product }: AddProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product ? {
      ...product,
      size: product.size || "",
      unit_type: product.unit_type || undefined,
      requires_packaging: product.requires_packaging || false,
      supplier_id: product.supplier_id || undefined,
      product_type: product.product_type || 'finished',
    } : {
      sku: "",
      name: "",
      description: "",
      category: "",
      price: 0,
      cost: 0,
      reorder_level: 10,
      is_active: true,
      size: "",
      unit_type: undefined,
      requires_packaging: false,
      supplier_id: undefined,
      product_type: 'finished',
    },
  });

  const isActive = watch("is_active");
  const requiresPackaging = watch("requires_packaging");
  const unitType = watch("unit_type");
  const supplierId = watch("supplier_id");
  const productType = watch("product_type");

  // Reset form when product changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          ...product,
          size: product.size || "",
          unit_type: product.unit_type || undefined,
          requires_packaging: product.requires_packaging || false,
          supplier_id: product.supplier_id || undefined,
          product_type: product.product_type || 'finished',
        });
      } else {
        reset({
          sku: "",
          name: "",
          description: "",
          category: "",
          price: 0,
          cost: 0,
          reorder_level: 10,
          is_active: true,
          size: "",
          unit_type: undefined,
          requires_packaging: false,
          supplier_id: undefined,
          product_type: 'finished',
        });
      }
    }
  }, [open, product, reset]);

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      if (product) {
        const { error } = await supabase
          .from("products")
          .update(data as any)
          .eq("id", product.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        const { error } = await supabase
          .from("products")
          .insert([data as any]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      reset();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save product",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product information" : "Create a new product in your catalog"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                {...register("sku")}
                placeholder="PROD-001"
                disabled={!!product}
              />
              {errors.sku && (
                <p className="text-sm text-red-500">{errors.sku.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Product Name"
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Product description"
              rows={3}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                {...register("category")}
                placeholder="Electronics, Clothing, etc."
              />
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_id">Supplier</Label>
              <Select 
                value={supplierId} 
                onValueChange={(value) => setValue("supplier_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplier_id && (
                <p className="text-sm text-red-500">{errors.supplier_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                {...register("size")}
                placeholder="e.g., 500, 1"
              />
              {errors.size && (
                <p className="text-sm text-red-500">{errors.size.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_type">Unit</Label>
              <Select 
                value={unitType} 
                onValueChange={(value) => setValue("unit_type", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="liters">Liters</SelectItem>
                  <SelectItem value="grams">Grams</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="pieces">Pieces</SelectItem>
                  <SelectItem value="boxes">Boxes</SelectItem>
                </SelectContent>
              </Select>
              {errors.unit_type && (
                <p className="text-sm text-red-500">{errors.unit_type.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (PKR) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.price && (
                <p className="text-sm text-red-500">{errors.price.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Cost (PKR)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                {...register("cost", { valueAsNumber: true })}
                placeholder="0.00"
              />
              {errors.cost && (
                <p className="text-sm text-red-500">{errors.cost.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="reorder_level">Reorder Level *</Label>
              <Input
                id="reorder_level"
                type="number"
                {...register("reorder_level", { valueAsNumber: true })}
                placeholder="10"
              />
              {errors.reorder_level && (
                <p className="text-sm text-red-500">{errors.reorder_level.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_type">Product Type</Label>
              <Select 
                value={productType} 
                onValueChange={(value) => setValue("product_type", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished">Finished Product</SelectItem>
                  <SelectItem value="raw_material">Raw Material</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="requires_packaging" className="text-base cursor-pointer">
                Requires Packaging
              </Label>
              <p className="text-sm text-muted-foreground">
                Does this product require packaging materials (bottles, boxes, etc.)?
              </p>
            </div>
            <Switch
              id="requires_packaging"
              checked={requiresPackaging}
              onCheckedChange={(checked) => setValue("requires_packaging", checked)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={(checked) => setValue("is_active", checked)}
            />
            <Label htmlFor="is_active" className="cursor-pointer">
              Active Product
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Update Product" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
