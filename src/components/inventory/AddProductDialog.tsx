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
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Gift } from "lucide-react";

const productSchema = z.object({
  sku: z.string().trim().max(50, "SKU must be less than 50 characters").optional().or(z.literal("")),
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
  is_bundle: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
}

export function AddProductDialog({ open, onOpenChange, product }: AddProductDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [packagingRequirements, setPackagingRequirements] = useState<Record<string, number>>({});
  const [bundleItems, setBundleItems] = useState<Record<string, { quantity: number; notes?: string }>>({});
  const [bundleSearchTerm, setBundleSearchTerm] = useState("");
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

  // Fetch packaging items
  const { data: packagingItems = [] } = useQuery({
    queryKey: ['packaging-items-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('packaging_items')
        .select('id, name, sku, type, current_stock')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch all products for bundle components
  const { data: availableProducts = [] } = useQuery({
    queryKey: ['products-for-bundles', product?.id],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, sku, size, unit_type')
        .eq('is_active', true)
        .order('name');
      
      // Exclude current product if editing
      if (product?.id) {
        query = query.neq('id', product.id);
      }
      
      const { data, error } = await query;
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
      is_bundle: product.is_bundle || false,
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
      is_bundle: false,
    },
  });

  const isActive = watch("is_active");
  const requiresPackaging = watch("requires_packaging");
  const isBundle = watch("is_bundle");
  const unitType = watch("unit_type");
  const supplierId = watch("supplier_id");

  // Filter products for bundle search
  const filteredBundleProducts = availableProducts.filter(p =>
    p.name.toLowerCase().includes(bundleSearchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(bundleSearchTerm.toLowerCase()))
  );

  // Fetch existing packaging requirements when editing
  useEffect(() => {
    const fetchPackagingRequirements = async () => {
      if (open && product?.id) {
        const { data, error } = await supabase
          .from('product_packaging_requirements')
          .select('packaging_item_id, quantity_required')
          .eq('product_id', product.id);
        
        if (!error && data) {
          const requirements: Record<string, number> = {};
          data.forEach(req => {
            requirements[req.packaging_item_id] = req.quantity_required;
          });
          setPackagingRequirements(requirements);
        }
      } else if (open && !product) {
        setPackagingRequirements({});
      }
    };

    fetchPackagingRequirements();
  }, [open, product]);

  // Fetch existing bundle items when editing
  useEffect(() => {
    const fetchBundleItems = async () => {
      if (open && product?.id && product.is_bundle) {
        const { data, error } = await supabase
          .from('product_bundle_items')
          .select('component_product_id, quantity, notes')
          .eq('bundle_product_id', product.id);
        
        if (!error && data) {
          const items: Record<string, { quantity: number; notes?: string }> = {};
          data.forEach(item => {
            items[item.component_product_id] = {
              quantity: item.quantity,
              notes: item.notes || undefined
            };
          });
          setBundleItems(items);
        }
      } else if (open && !product) {
        setBundleItems({});
      }
    };

    fetchBundleItems();
  }, [open, product]);

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
          is_bundle: product.is_bundle || false,
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
          is_bundle: false,
        });
        setBundleItems({});
      }
    }
  }, [open, product, reset]);

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true);
    try {
      // Transform empty SKU to null
      const productData = {
        ...data,
        sku: data.sku && data.sku.trim() !== "" ? data.sku : null,
      };

      let productId: string;

      if (product) {
        const { error } = await supabase
          .from("products")
          .update(productData as any)
          .eq("id", product.id);

        if (error) throw error;
        productId = product.id;

        // Update packaging requirements if packaging is required
        if (data.requires_packaging) {
          // Delete existing requirements
          await supabase
            .from('product_packaging_requirements')
            .delete()
            .eq('product_id', productId);

          // Insert new requirements
          const requirementsToInsert = Object.entries(packagingRequirements)
            .filter(([_, qty]) => qty > 0)
            .map(([packagingItemId, quantity]) => ({
              product_id: productId,
              packaging_item_id: packagingItemId,
              quantity_required: quantity,
            }));

          if (requirementsToInsert.length > 0) {
            const { error: reqError } = await supabase
              .from('product_packaging_requirements')
              .insert(requirementsToInsert);
            
            if (reqError) throw reqError;
          }
        } else {
          // If packaging not required, delete all requirements
          await supabase
            .from('product_packaging_requirements')
            .delete()
            .eq('product_id', productId);
        }

        // Update bundle items if this is a bundle
        if (data.is_bundle) {
          // Delete existing bundle items
          await supabase
            .from('product_bundle_items')
            .delete()
            .eq('bundle_product_id', productId);

          // Insert new bundle items
          const bundleItemsToInsert = Object.entries(bundleItems)
            .filter(([_, item]) => item.quantity > 0)
            .map(([componentProductId, item]) => ({
              bundle_product_id: productId,
              component_product_id: componentProductId,
              quantity: item.quantity,
              notes: item.notes || null,
            }));

          if (bundleItemsToInsert.length > 0) {
            const { error: bundleError } = await supabase
              .from('product_bundle_items')
              .insert(bundleItemsToInsert);
            
            if (bundleError) throw bundleError;
          }
        } else {
          // If not a bundle, delete all bundle items
          await supabase
            .from('product_bundle_items')
            .delete()
            .eq('bundle_product_id', productId);
        }

        toast({
          title: "Success",
          description: "Product updated successfully",
        });
      } else {
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert([productData as any])
          .select()
          .single();

        if (error) throw error;
        productId = newProduct.id;

        // Insert packaging requirements if packaging is required
        if (data.requires_packaging) {
          const requirementsToInsert = Object.entries(packagingRequirements)
            .filter(([_, qty]) => qty > 0)
            .map(([packagingItemId, quantity]) => ({
              product_id: productId,
              packaging_item_id: packagingItemId,
              quantity_required: quantity,
            }));

          if (requirementsToInsert.length > 0) {
            const { error: reqError } = await supabase
              .from('product_packaging_requirements')
              .insert(requirementsToInsert);
            
            if (reqError) throw reqError;
          }
        }

        // Insert bundle items if this is a bundle
        if (data.is_bundle) {
          const bundleItemsToInsert = Object.entries(bundleItems)
            .filter(([_, item]) => item.quantity > 0)
            .map(([componentProductId, item]) => ({
              bundle_product_id: productId,
              component_product_id: componentProductId,
              quantity: item.quantity,
              notes: item.notes || null,
            }));

          if (bundleItemsToInsert.length > 0) {
            const { error: bundleError } = await supabase
              .from('product_bundle_items')
              .insert(bundleItemsToInsert);
            
            if (bundleError) throw bundleError;
          }
        }

        toast({
          title: "Success",
          description: "Product created successfully",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      reset();
      setPackagingRequirements({});
      setBundleItems({});
      setBundleSearchTerm("");
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
              <Label htmlFor="sku">SKU</Label>
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

          <div className="space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
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
                onCheckedChange={(checked) => {
                  setValue("requires_packaging", checked);
                  if (!checked) {
                    setPackagingRequirements({});
                  }
                }}
              />
            </div>

            {requiresPackaging && (
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Package className="h-4 w-4" />
                  Select Packaging Items & Quantities
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {packagingItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active packaging items available</p>
                  ) : (
                    packagingItems.map((item) => {
                      const isSelected = packagingRequirements[item.id] > 0;
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                          <Checkbox
                            id={`pkg-${item.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setPackagingRequirements(prev => ({ ...prev, [item.id]: 1 }));
                              } else {
                                setPackagingRequirements(prev => {
                                  const updated = { ...prev };
                                  delete updated[item.id];
                                  return updated;
                                });
                              }
                            }}
                          />
                          <Label htmlFor={`pkg-${item.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium">{item.name}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({item.type} • Stock: {item.current_stock})
                                </span>
                              </div>
                            </div>
                          </Label>
                          {isSelected && (
                            <Input
                              type="number"
                              min="1"
                              className="w-20"
                              value={packagingRequirements[item.id] || 1}
                              onChange={(e) => {
                                const value = parseInt(e.target.value) || 1;
                                setPackagingRequirements(prev => ({
                                  ...prev,
                                  [item.id]: Math.max(1, value)
                                }));
                              }}
                              placeholder="Qty"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-lg border p-4 border-purple-200 bg-purple-50/50">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="is_bundle" className="text-base cursor-pointer">
                  🎁 This is a Bundle/Deal
                </Label>
                <p className="text-sm text-muted-foreground">
                  Create a gift set, tester box, or deal combining multiple products
                </p>
              </div>
              <Switch
                id="is_bundle"
                checked={isBundle}
                onCheckedChange={(checked) => {
                  setValue("is_bundle", checked);
                  if (!checked) {
                    setBundleItems({});
                    setBundleSearchTerm("");
                  }
                }}
              />
            </div>

            {isBundle && (
              <div className="mt-4 space-y-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Gift className="h-4 w-4" />
                  Select Products to Include in Bundle
                </div>
                
                <Input
                  placeholder="Search products..."
                  value={bundleSearchTerm}
                  onChange={(e) => setBundleSearchTerm(e.target.value)}
                />
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredBundleProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {bundleSearchTerm ? "No products found" : "No products available"}
                    </p>
                  ) : (
                    filteredBundleProducts.map((prod) => {
                      const isSelected = !!bundleItems[prod.id];
                      return (
                        <div key={prod.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50">
                          <Checkbox
                            id={`bundle-${prod.id}`}
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setBundleItems(prev => ({ 
                                  ...prev, 
                                  [prod.id]: { quantity: 1 } 
                                }));
                              } else {
                                setBundleItems(prev => {
                                  const updated = { ...prev };
                                  delete updated[prod.id];
                                  return updated;
                                });
                              }
                            }}
                          />
                          <Label htmlFor={`bundle-${prod.id}`} className="flex-1 cursor-pointer">
                            <span className="font-medium">{prod.name}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              ({prod.sku || 'No SKU'} • {prod.size}{prod.unit_type})
                            </span>
                          </Label>
                          {isSelected && (
                            <>
                              <Input
                                type="number"
                                min="1"
                                className="w-16"
                                value={bundleItems[prod.id]?.quantity || 1}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  setBundleItems(prev => ({
                                    ...prev,
                                    [prod.id]: {
                                      ...prev[prod.id],
                                      quantity: Math.max(1, value)
                                    }
                                  }));
                                }}
                                placeholder="Qty"
                              />
                              <Input
                                className="w-32"
                                value={bundleItems[prod.id]?.notes || ""}
                                onChange={(e) => {
                                  setBundleItems(prev => ({
                                    ...prev,
                                    [prod.id]: {
                                      ...prev[prod.id],
                                      notes: e.target.value
                                    }
                                  }));
                                }}
                                placeholder="Notes (e.g., 5ml)"
                              />
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                
                {Object.keys(bundleItems).length > 0 && (
                  <div className="mt-2 p-2 bg-purple-100 rounded text-sm">
                    Bundle contains {Object.keys(bundleItems).length} products
                  </div>
                )}
              </div>
            )}
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
