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
import { Loader2, Package, Gift, DollarSign, Tag, Boxes, Info, Settings2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCurrency } from "@/hooks/useCurrency";

const productSchema = z.object({
  sku: z.string().trim().max(50, "SKU must be less than 50 characters").nullable().transform(v => v ?? "").optional().or(z.literal("")),
  name: z.string().trim().min(1, "Name is required").max(200, "Name must be less than 200 characters"),
  description: z.string().trim().max(1000, "Description must be less than 1000 characters").nullable().transform(v => v ?? "").optional(),
  category: z.string().trim().max(100, "Category must be less than 100 characters").nullable().transform(v => v ?? "").optional(),
  price: z.number().min(0, "Retail price must be positive"),
  cost: z.number().positive("Cost is required and must be greater than 0"),
  reorder_level: z.number().int().min(0, "Reorder level must be a positive integer"),
  is_active: z.boolean(),
  size: z.string().nullable().transform(v => v ?? "").optional(),
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
  const { currencySymbol, formatCurrency } = useCurrency();

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
      sku: product.sku || "",
      name: product.name || "",
      description: product.description || "",
      category: product.category || "",
      price: product.price || 0,
      cost: product.cost || 0,
      reorder_level: product.reorder_level || 10,
      is_active: product.is_active ?? true,
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
          sku: product.sku || "",
          name: product.name || "",
          description: product.description || "",
          category: product.category || "",
          price: product.price || 0,
          cost: product.cost || 0,
          reorder_level: product.reorder_level || 10,
          is_active: product.is_active ?? true,
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
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {isBundle ? <Gift className="h-5 w-5 text-primary" /> : <Package className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <DialogTitle className="text-lg">{product ? "Edit Product" : "Add New Product"}</DialogTitle>
              <DialogDescription className="text-sm">
                {product ? "Update product information and settings" : "Create a new product in your catalog"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <Tabs defaultValue="basic" className="flex flex-col flex-1 overflow-hidden">
            <div className="px-6 pt-4 border-b shrink-0">
              <TabsList className="grid w-full grid-cols-3 h-9">
                <TabsTrigger value="basic" className="text-sm gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Basic Info
                </TabsTrigger>
                <TabsTrigger value="pricing" className="text-sm gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                  Pricing
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-sm gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  Advanced
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="px-6 py-5">
                {/* Basic Info Tab */}
                <TabsContent value="basic" className="mt-0 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku" className="text-sm font-medium">SKU</Label>
                      <Input
                        id="sku"
                        {...register("sku")}
                        placeholder="PROD-001"
                        disabled={!!product}
                        className="h-9"
                      />
                      {errors.sku && <p className="text-xs text-destructive">{errors.sku.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium">Product Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        {...register("name")}
                        placeholder="Enter product name"
                        className="h-9"
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Describe your product..."
                      rows={3}
                      className="resize-none"
                    />
                    {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category" className="text-sm font-medium">Category</Label>
                      <Input
                        id="category"
                        {...register("category")}
                        placeholder="e.g., Fragrances, Oils"
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supplier_id" className="text-sm font-medium">Supplier</Label>
                      <Select 
                        value={supplierId} 
                        onValueChange={(value) => setValue("supplier_id", value)}
                      >
                        <SelectTrigger className="h-9">
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
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="size" className="text-sm font-medium">Size / Volume</Label>
                      <Input
                        id="size"
                        {...register("size")}
                        placeholder="e.g., 500, 100"
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="unit_type" className="text-sm font-medium">Unit Type</Label>
                      <Select 
                        value={unitType} 
                        onValueChange={(value) => setValue("unit_type", value as any)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select unit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ml">ml (Milliliters)</SelectItem>
                          <SelectItem value="liters">Liters</SelectItem>
                          <SelectItem value="grams">Grams</SelectItem>
                          <SelectItem value="kg">Kilograms</SelectItem>
                          <SelectItem value="pieces">Pieces</SelectItem>
                          <SelectItem value="boxes">Boxes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <Switch
                      id="is_active"
                      checked={isActive}
                      onCheckedChange={(checked) => setValue("is_active", checked)}
                    />
                    <Label htmlFor="is_active" className="cursor-pointer flex-1">
                      <span className="font-medium">Active Product</span>
                      <p className="text-xs text-muted-foreground">Product will be available for orders</p>
                    </Label>
                  </div>
                </TabsContent>

                {/* Pricing Tab */}
                <TabsContent value="pricing" className="mt-0 space-y-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cost" className="text-sm font-medium">Cost <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                        <Input
                          id="cost"
                          type="number"
                          step="0.01"
                          {...register("cost", { valueAsNumber: true })}
                          placeholder="0.00"
                          className="h-9 pl-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Raw materials + packaging</p>
                      {errors.cost && <p className="text-xs text-destructive">{errors.cost.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="price" className="text-sm font-medium">Retail Price <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          {...register("price", { valueAsNumber: true })}
                          placeholder="0.00"
                          className="h-9 pl-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Customer selling price</p>
                      {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reorder_level" className="text-sm font-medium">Reorder Level <span className="text-destructive">*</span></Label>
                      <Input
                        id="reorder_level"
                        type="number"
                        {...register("reorder_level", { valueAsNumber: true })}
                        placeholder="10"
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground">Low stock alert threshold</p>
                      {errors.reorder_level && <p className="text-xs text-destructive">{errors.reorder_level.message}</p>}
                    </div>
                  </div>

                  {/* Profit calculation preview */}
                  {watch("price") > 0 && watch("cost") > 0 && (
                    <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">Profit Margin</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-700 dark:text-green-400">
                            {formatCurrency(watch("price") - watch("cost"))}
                          </span>
                          <span className="text-xs text-green-600 dark:text-green-500 ml-2">
                            ({((watch("price") - watch("cost")) / watch("price") * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Advanced Tab */}
                <TabsContent value="advanced" className="mt-0 space-y-5">
                  {/* Packaging Section */}
                  <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between p-4 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-background flex items-center justify-center border">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <Label htmlFor="requires_packaging" className="font-medium cursor-pointer">
                            Requires Packaging
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Link packaging materials to this product
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="requires_packaging"
                        checked={requiresPackaging}
                        onCheckedChange={(checked) => {
                          setValue("requires_packaging", checked);
                          if (!checked) setPackagingRequirements({});
                        }}
                      />
                    </div>

                    {requiresPackaging && (
                      <div className="p-4 border-t bg-background">
                        <p className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5" />
                          Select Packaging Items
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {packagingItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">No active packaging items available</p>
                          ) : (
                            packagingItems.map((item) => {
                              const isSelected = packagingRequirements[item.id] > 0;
                              return (
                                <div key={item.id} className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${isSelected ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50'}`}>
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
                                    <span className="font-medium text-sm">{item.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {item.type} • Stock: {item.current_stock}
                                    </span>
                                  </Label>
                                  {isSelected && (
                                    <Input
                                      type="number"
                                      min="1"
                                      className="w-16 h-8 text-center"
                                      value={packagingRequirements[item.id] || 1}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 1;
                                        setPackagingRequirements(prev => ({
                                          ...prev,
                                          [item.id]: Math.max(1, value)
                                        }));
                                      }}
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

                  {/* Bundle Section */}
                  <div className="rounded-lg border overflow-hidden border-purple-200 dark:border-purple-900">
                    <div className="flex items-center justify-between p-4 bg-purple-50/50 dark:bg-purple-950/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                          <Gift className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <Label htmlFor="is_bundle" className="font-medium cursor-pointer">
                            Bundle / Deal Product
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Create a set combining multiple products
                          </p>
                        </div>
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
                      <div className="p-4 border-t bg-background">
                        <Input
                          placeholder="Search products to add..."
                          value={bundleSearchTerm}
                          onChange={(e) => setBundleSearchTerm(e.target.value)}
                          className="mb-3 h-9"
                        />
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {filteredBundleProducts.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              {bundleSearchTerm ? "No products found" : "No products available"}
                            </p>
                          ) : (
                            filteredBundleProducts.slice(0, 10).map((prod) => {
                              const isSelected = !!bundleItems[prod.id];
                              return (
                                <div key={prod.id} className={`flex items-center gap-3 p-2.5 rounded-md border transition-colors ${isSelected ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800' : 'hover:bg-muted/50'}`}>
                                  <Checkbox
                                    id={`bundle-${prod.id}`}
                                    checked={isSelected}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setBundleItems(prev => ({ ...prev, [prod.id]: { quantity: 1 } }));
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
                                    <span className="font-medium text-sm">{prod.name}</span>
                                    <span className="text-xs text-muted-foreground ml-2">
                                      {prod.sku || 'No SKU'} • {prod.size}{prod.unit_type}
                                    </span>
                                  </Label>
                                  {isSelected && (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min="1"
                                        className="w-14 h-8 text-center"
                                        value={bundleItems[prod.id]?.quantity || 1}
                                        onChange={(e) => {
                                          const value = parseInt(e.target.value) || 1;
                                          setBundleItems(prev => ({
                                            ...prev,
                                            [prod.id]: { ...prev[prod.id], quantity: Math.max(1, value) }
                                          }));
                                        }}
                                      />
                                      <Input
                                        className="w-24 h-8"
                                        value={bundleItems[prod.id]?.notes || ""}
                                        onChange={(e) => {
                                          setBundleItems(prev => ({
                                            ...prev,
                                            [prod.id]: { ...prev[prod.id], notes: e.target.value }
                                          }));
                                        }}
                                        placeholder="e.g., 5ml"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                        
                        {Object.keys(bundleItems).length > 0 && (
                          <div className="mt-3 p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-md text-sm font-medium text-purple-700 dark:text-purple-300 flex items-center gap-2">
                            <Boxes className="h-4 w-4" />
                            Bundle contains {Object.keys(bundleItems).length} product{Object.keys(bundleItems).length > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <Separator />
          
          <DialogFooter className="px-6 py-4 bg-muted/20">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {product ? "Update Product" : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
