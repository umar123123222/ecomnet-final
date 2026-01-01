import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Plus, Trash2, Box, ShoppingBag, Gift, Search, Minus, X, ArrowRight, FileText, Warehouse, Building2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const transferSchema = z.object({
  from_outlet_id: z.string().min(1, "Source outlet is required"),
  to_outlet_id: z.string().min(1, "Destination outlet is required"),
  notes: z.string().trim().max(500, "Notes must be less than 500 characters").optional(),
}).refine((data) => data.from_outlet_id !== data.to_outlet_id, {
  message: "Source and destination outlets must be different",
  path: ["to_outlet_id"],
});

type TransferFormData = z.infer<typeof transferSchema>;

interface PackagingItem {
  packaging_item_id: string;
  quantity: number;
  name: string;
  sku: string;
  current_stock: number;
}

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
  const [packagingItems, setPackagingItems] = useState<PackagingItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  const mainWarehouse = outlets?.find(
    (outlet) => outlet.outlet_type === 'warehouse' && outlet.name.toLowerCase().includes('main')
  ) || outlets?.find((outlet) => outlet.outlet_type === 'warehouse');

  const isStoreManager = profile?.role === 'store_manager';
  
  const { data: userOutlet } = useQuery({
    queryKey: ["user-assigned-outlet", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data: managedOutlet } = await supabase
        .from("outlets")
        .select("id, name, outlet_type")
        .eq("manager_id", user.id)
        .single();
      
      if (managedOutlet) return managedOutlet;
      
      const { data: staffOutlet } = await supabase
        .from("outlet_staff")
        .select("outlet:outlets(id, name, outlet_type)")
        .eq("user_id", user.id)
        .single();
      
      return staffOutlet?.outlet || null;
    },
    enabled: open && isStoreManager && !!user?.id,
  });

  const { data: availablePackaging } = useQuery({
    queryKey: ["packaging-items-for-transfer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packaging_items")
        .select("id, name, sku, current_stock")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: warehouseInventory } = useQuery({
    queryKey: ["warehouse-inventory", mainWarehouse?.id],
    queryFn: async () => {
      if (!mainWarehouse?.id) return {};
      const { data, error } = await supabase
        .from("inventory")
        .select("product_id, quantity, available_quantity")
        .eq("outlet_id", mainWarehouse.id);
      if (error) throw error;
      return (data || []).reduce((acc, inv) => {
        acc[inv.product_id] = inv;
        return acc;
      }, {} as Record<string, { quantity: number; available_quantity: number | null }>);
    },
    enabled: open && !!mainWarehouse?.id,
  });

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

  useEffect(() => {
    if (open) {
      if (mainWarehouse?.id) {
        setValue("from_outlet_id", mainWarehouse.id);
      }
      if (isStoreManager && userOutlet?.id) {
        setValue("to_outlet_id", userOutlet.id);
      }
    }
  }, [open, mainWarehouse?.id, isStoreManager, userOutlet?.id, setValue]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!productSearch.trim()) return products;
    const search = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        (p.sku && p.sku.toLowerCase().includes(search))
    );
  }, [products, productSearch]);

  const selectablePackaging = useMemo(() => {
    if (!availablePackaging) return [];
    const addedIds = new Set(packagingItems.map((p) => p.packaging_item_id));
    return availablePackaging.filter((p) => !addedIds.has(p.id));
  }, [availablePackaging, packagingItems]);

  const addProduct = (productId: string) => {
    setSelectedProducts((prev) => ({ ...prev, [productId]: 1 }));
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSelected = { ...prev };
      delete newSelected[productId];
      return newSelected;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const stock = warehouseInventory?.[productId];
    const maxQty = stock?.available_quantity ?? stock?.quantity ?? 9999;
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: Math.max(1, Math.min(quantity, maxQty)),
    }));
  };

  const incrementQuantity = (productId: string) => {
    const current = selectedProducts[productId] || 0;
    updateQuantity(productId, current + 1);
  };

  const decrementQuantity = (productId: string) => {
    const current = selectedProducts[productId] || 0;
    if (current <= 1) {
      removeProduct(productId);
    } else {
      updateQuantity(productId, current - 1);
    }
  };

  const addPackaging = (packagingId: string) => {
    const packaging = availablePackaging?.find((p) => p.id === packagingId);
    if (packaging) {
      setPackagingItems((prev) => [
        ...prev,
        {
          packaging_item_id: packaging.id,
          quantity: 1,
          name: packaging.name,
          sku: packaging.sku,
          current_stock: packaging.current_stock,
        },
      ]);
    }
  };

  const updatePackagingQuantity = (packagingId: string, quantity: number) => {
    setPackagingItems((prev) =>
      prev.map((p) =>
        p.packaging_item_id === packagingId
          ? { ...p, quantity: Math.max(1, quantity) }
          : p
      )
    );
  };

  const removePackaging = (packagingId: string) => {
    setPackagingItems((prev) =>
      prev.filter((p) => p.packaging_item_id !== packagingId)
    );
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
      const items = Object.entries(selectedProducts).map(([product_id, quantity]) => ({
        product_id,
        quantity,
      }));

      const allPackaging = packagingItems.map((p) => ({
        packaging_item_id: p.packaging_item_id,
        quantity: p.quantity,
        is_auto_calculated: false,
      }));

      const { error } = await supabase.functions.invoke(
        "stock-transfer-request",
        {
          body: {
            action: "create",
            items,
            packaging_items: allPackaging,
            from_outlet_id: data.from_outlet_id,
            to_outlet_id: data.to_outlet_id,
            notes: data.notes,
          },
        }
      );

      if (error) throw error;

      toast({
        title: "Transfer request created",
        description: `${items.length} product(s) and ${allPackaging.length} packaging item(s) added`,
      });

      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      reset();
      setSelectedProducts({});
      setPackagingItems([]);
      setProductSearch("");
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

  useEffect(() => {
    if (!open) {
      setSelectedProducts({});
      setPackagingItems([]);
      setProductSearch("");
    }
  }, [open]);

  const totalProducts = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);
  const selectedProductsList = Object.keys(selectedProducts);

  const getProductName = (productId: string) => {
    return products?.find((p) => p.id === productId)?.name || "Unknown Product";
  };

  const getProductSku = (productId: string) => {
    return products?.find((p) => p.id === productId)?.sku || "";
  };

  const getProductStock = (productId: string) => {
    const stock = warehouseInventory?.[productId];
    return stock?.available_quantity ?? stock?.quantity ?? 0;
  };

  const getPackagingIcon = (name: string) => {
    if (name.toLowerCase().includes("box")) return <Box className="h-4 w-4 text-muted-foreground" />;
    if (name.toLowerCase().includes("bag")) return <ShoppingBag className="h-4 w-4 text-muted-foreground" />;
    if (name.toLowerCase().includes("gift")) return <Gift className="h-4 w-4 text-muted-foreground" />;
    return <Package className="h-4 w-4 text-muted-foreground" />;
  };

  const destinationOutlets = outlets?.filter((outlet) => outlet.id !== mainWarehouse?.id) || [];
  const destinationOutletName = watch("to_outlet_id") 
    ? outlets?.find(o => o.id === watch("to_outlet_id"))?.name 
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b bg-muted/30 shrink-0">
          <SheetTitle className="text-xl font-semibold">New Transfer Request</SheetTitle>
          <SheetDescription>
            Request inventory transfer from warehouse to your outlet
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
          {/* Transfer Route Visual */}
          <div className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Warehouse className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-medium truncate">{mainWarehouse?.name || "Main Warehouse"}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                <div className="h-px w-6 bg-border" />
                <ArrowRight className="h-4 w-4" />
                <div className="h-px w-6 bg-border" />
              </div>
              
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                  destinationOutletName ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-muted"
                )}>
                  <Building2 className={cn(
                    "h-5 w-5",
                    destinationOutletName ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                  )} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">To</p>
                  {isStoreManager && userOutlet ? (
                    <p className="font-medium truncate">{userOutlet.name}</p>
                  ) : destinationOutletName ? (
                    <p className="font-medium truncate">{destinationOutletName}</p>
                  ) : (
                    <Select
                      value={watch("to_outlet_id")}
                      onValueChange={(value) => setValue("to_outlet_id", value)}
                    >
                      <SelectTrigger className={cn(
                        "h-8 w-full border-dashed text-sm",
                        errors.to_outlet_id && "border-destructive"
                      )}>
                        <SelectValue placeholder="Select outlet..." />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {destinationOutlets.map((outlet) => (
                          <SelectItem key={outlet.id} value={outlet.id}>
                            {outlet.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>
            {errors.to_outlet_id && (
              <p className="text-xs text-destructive mt-2">{errors.to_outlet_id.message}</p>
            )}
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-6 space-y-6">
              {/* Product Search */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Add Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                
                {productSearch && (
                  <Card className="mt-2 max-h-48 overflow-y-auto divide-y">
                    {filteredProducts.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No products found
                      </div>
                    ) : (
                      filteredProducts.slice(0, 10).map((product) => {
                        const isSelected = !!selectedProducts[product.id];
                        const stock = getProductStock(product.id);
                        const isOutOfStock = stock <= 0;
                        
                        return (
                          <div
                            key={product.id}
                            className={cn(
                              "flex items-center justify-between p-3 transition-colors",
                              isSelected 
                                ? "bg-primary/5" 
                                : isOutOfStock 
                                ? "opacity-50" 
                                : "hover:bg-muted/50 cursor-pointer"
                            )}
                            onClick={() => !isSelected && !isOutOfStock && addProduct(product.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground">{product.sku}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge 
                                variant={stock > 10 ? "secondary" : stock > 0 ? "outline" : "destructive"}
                                className="text-xs"
                              >
                                {stock} in stock
                              </Badge>
                              {isSelected ? (
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                              ) : !isOutOfStock ? (
                                <Plus className="h-4 w-4 text-muted-foreground" />
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </Card>
                )}
              </div>

              {/* Selected Products */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Selected Products</Label>
                  {selectedProductsList.length > 0 && (
                    <Badge variant="secondary" className="gap-1">
                      <Package className="h-3 w-3" />
                      {selectedProductsList.length} products • {totalProducts} units
                    </Badge>
                  )}
                </div>
                
                {selectedProductsList.length === 0 ? (
                  <Card className="p-8 text-center border-dashed">
                    <div className="h-12 w-12 rounded-xl bg-muted mx-auto mb-3 flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium mb-1">No products selected</p>
                    <p className="text-xs text-muted-foreground">
                      Search and select products above to add them to this transfer
                    </p>
                  </Card>
                ) : (
                  <Card className="divide-y">
                    {selectedProductsList.map((productId) => {
                      const stock = getProductStock(productId);
                      const qty = selectedProducts[productId];
                      
                      return (
                        <div key={productId} className="p-3 flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{getProductName(productId)}</p>
                            <p className="text-xs text-muted-foreground">{getProductSku(productId)} • {stock} available</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => decrementQuantity(productId)}
                            >
                              {qty === 1 ? <Trash2 className="h-3.5 w-3.5 text-destructive" /> : <Minus className="h-3.5 w-3.5" />}
                            </Button>
                            <Input
                              type="number"
                              min="1"
                              max={stock}
                              value={qty}
                              onChange={(e) => updateQuantity(productId, parseInt(e.target.value) || 1)}
                              className="w-14 h-8 text-center text-sm"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => incrementQuantity(productId)}
                              disabled={qty >= stock}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </Card>
                )}
              </div>

              {/* Packaging Items */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Packaging Items (Optional)</Label>
                <div className="space-y-2">
                  {packagingItems.length > 0 && (
                    <Card className="divide-y">
                      {packagingItems.map((item) => (
                        <div key={item.packaging_item_id} className="p-3 flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            {getPackagingIcon(item.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium truncate block">{item.name}</span>
                            {item.current_stock < item.quantity && (
                              <Badge variant="destructive" className="text-xs mt-1">
                                Low stock ({item.current_stock})
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                updatePackagingQuantity(
                                  item.packaging_item_id,
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="w-16 h-8 text-center"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removePackaging(item.packaging_item_id)}
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </Card>
                  )}

                  {selectablePackaging.length > 0 && (
                    <Select onValueChange={addPackaging} value="">
                      <SelectTrigger className="border-dashed">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Plus className="h-4 w-4" />
                          <span>Add packaging item...</span>
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {selectablePackaging.map((packaging) => (
                          <SelectItem key={packaging.id} value={packaging.id}>
                            <div className="flex items-center justify-between gap-4">
                              <span>{packaging.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {packaging.current_stock} available
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes" className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder="Add any special instructions or notes..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                {selectedProductsList.length > 0 ? (
                  <span className="text-foreground font-medium">{selectedProductsList.length} products</span>
                ) : (
                  "No products selected"
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || selectedProductsList.length === 0}
                  className="min-w-[140px] gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create Request
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}