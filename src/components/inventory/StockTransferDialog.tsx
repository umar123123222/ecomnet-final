import { useState, useEffect, useMemo } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Plus, Trash2, Box, ShoppingBag, Gift, Search, Minus, X, ArrowRight } from "lucide-react";
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

interface SelectedProduct {
  product_id: string;
  quantity: number;
}

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
  const { user } = useAuth();

  // Find main warehouse
  const mainWarehouse = outlets?.find(
    (outlet) => outlet.outlet_type === 'warehouse' && outlet.name.toLowerCase().includes('main')
  ) || outlets?.find((outlet) => outlet.outlet_type === 'warehouse');

  // Fetch packaging items from database
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

  // Fetch inventory for warehouse
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

  // Filter products by search
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

  // Available packaging for selection (exclude already added)
  const selectablePackaging = useMemo(() => {
    if (!availablePackaging) return [];
    const addedIds = new Set(packagingItems.map((p) => p.packaging_item_id));
    return availablePackaging.filter((p) => !addedIds.has(p.id));
  }, [availablePackaging, packagingItems]);

  const addProduct = (productId: string) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: 1,
    }));
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
      // Prepare items array
      const items = Object.entries(selectedProducts).map(([product_id, quantity]) => ({
        product_id,
        quantity,
      }));

      // All packaging is manually selected
      const allPackaging = packagingItems.map((p) => ({
        packaging_item_id: p.packaging_item_id,
        quantity: p.quantity,
        is_auto_calculated: false,
      }));

      const { data: result, error } = await supabase.functions.invoke(
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
        title: "Success",
        description: `Created stock transfer request with ${items.length} product(s) and ${allPackaging.length} packaging item(s)`,
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

  // Reset state when dialog closes
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30">
          <DialogTitle className="text-xl">New Stock Transfer</DialogTitle>
          <DialogDescription>
            Transfer products and packaging from warehouse to outlets
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
            {/* Left Panel - Product Selection */}
            <div className="flex flex-col overflow-hidden">
              <div className="p-4 border-b bg-background">
                <Label className="text-sm font-medium mb-2 block">Select Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">
                      {productSearch ? "No products found" : "No products available"}
                    </p>
                  ) : (
                    filteredProducts.map((product) => {
                      const isSelected = !!selectedProducts[product.id];
                      const stock = getProductStock(product.id);
                      const isOutOfStock = stock <= 0;
                      
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            isSelected 
                              ? "bg-primary/10 border border-primary/30" 
                              : isOutOfStock
                              ? "bg-muted/50 opacity-60"
                              : "hover:bg-muted/50 cursor-pointer"
                          }`}
                          onClick={() => !isSelected && !isOutOfStock && addProduct(product.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{product.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">{product.sku}</span>
                              <Badge 
                                variant={stock > 10 ? "secondary" : stock > 0 ? "outline" : "destructive"}
                                className="text-xs h-5"
                              >
                                Stock: {stock}
                              </Badge>
                            </div>
                          </div>
                          
                          {isSelected ? (
                            <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => decrementQuantity(product.id)}
                              >
                                {selectedProducts[product.id] === 1 ? (
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                ) : (
                                  <Minus className="h-3 w-3" />
                                )}
                              </Button>
                              <Input
                                type="number"
                                min="1"
                                max={stock}
                                value={selectedProducts[product.id]}
                                onChange={(e) => updateQuantity(product.id, parseInt(e.target.value) || 1)}
                                className="w-14 h-7 text-center text-sm"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => incrementQuantity(product.id)}
                                disabled={selectedProducts[product.id] >= stock}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : !isOutOfStock ? (
                            <Button type="button" variant="ghost" size="sm" className="h-7 ml-2">
                              <Plus className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right Panel - Transfer Details */}
            <div className="flex flex-col overflow-hidden bg-muted/20">
              <div className="p-4 border-b bg-background">
                <Label className="text-sm font-medium mb-2 block">Transfer To</Label>
                <Select
                  value={watch("to_outlet_id")}
                  onValueChange={(value) => setValue("to_outlet_id", value)}
                >
                  <SelectTrigger className={errors.to_outlet_id ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select destination..." />
                  </SelectTrigger>
                  <SelectContent>
                    {outlets
                      ?.filter((outlet) => outlet.id !== mainWarehouse?.id)
                      ?.map((outlet) => (
                        <SelectItem key={outlet.id} value={outlet.id}>
                          {outlet.name} ({outlet.outlet_type === "warehouse" ? "Warehouse" : "Outlet"})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.to_outlet_id && (
                  <p className="text-xs text-destructive mt-1">{errors.to_outlet_id.message}</p>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {/* Selected Products Summary */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Selected Items</Label>
                      {selectedProductsList.length > 0 && (
                        <Badge variant="secondary">
                          {selectedProductsList.length} products • {totalProducts} units
                        </Badge>
                      )}
                    </div>
                    
                    {selectedProductsList.length === 0 ? (
                      <Card className="p-6 text-center border-dashed">
                        <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Select products from the left panel
                        </p>
                      </Card>
                    ) : (
                      <Card className="divide-y">
                        {selectedProductsList.map((productId) => (
                          <div key={productId} className="p-3 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{getProductName(productId)}</p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              <Badge variant="outline">×{selectedProducts[productId]}</Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => removeProduct(productId)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>

                  {/* Packaging Items - Fully Manual Selection */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Packaging Items</Label>
                    <div className="space-y-2">
                      {packagingItems.map((item) => (
                        <Card key={item.packaging_item_id} className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getPackagingIcon(item.name)}
                            <div>
                              <span className="text-sm">{item.name}</span>
                              {item.current_stock < item.quantity && (
                                <Badge variant="destructive" className="text-xs ml-2">
                                  Low stock ({item.current_stock})
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
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
                              className="w-16 h-7 text-center"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removePackaging(item.packaging_item_id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        </Card>
                      ))}

                      {selectablePackaging.length > 0 && (
                        <Select onValueChange={addPackaging}>
                          <SelectTrigger className="border-dashed">
                            <SelectValue placeholder="+ Add packaging item..." />
                          </SelectTrigger>
                          <SelectContent>
                            {selectablePackaging.map((packaging) => (
                              <SelectItem key={packaging.id} value={packaging.id}>
                                {packaging.name} (Stock: {packaging.current_stock})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {packagingItems.length === 0 && selectablePackaging.length === 0 && (
                        <Card className="p-4 text-center border-dashed">
                          <p className="text-sm text-muted-foreground">
                            No packaging items available
                          </p>
                        </Card>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="text-sm font-medium mb-2 block">Notes</Label>
                    <Textarea
                      id="notes"
                      {...register("notes")}
                      placeholder="Optional notes..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              </ScrollArea>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                From: <span className="font-medium text-foreground">{mainWarehouse?.name || "Main Warehouse"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting || selectedProductsList.length === 0}
                  className="min-w-[140px]"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create Transfer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
