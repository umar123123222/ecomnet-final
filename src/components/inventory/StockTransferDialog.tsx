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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Plus, Trash2, Box, ShoppingBag, Gift } from "lucide-react";
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
  is_auto_calculated: boolean;
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
  const [extraPackaging, setExtraPackaging] = useState<PackagingItem[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Find main warehouse
  const mainWarehouse = outlets?.find(
    (outlet) => outlet.outlet_type === 'warehouse' && outlet.name.toLowerCase().includes('main')
  ) || outlets?.find((outlet) => outlet.outlet_type === 'warehouse');

  // Fetch packaging items
  const { data: packagingItems } = useQuery({
    queryKey: ["packaging-items-for-transfer"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packaging_items")
        .select("id, name, sku, current_stock, allocation_type, linked_product_ids")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: open,
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

  // Calculate auto-packaging based on selected products
  const autoCalculatedPackaging = useMemo(() => {
    if (!packagingItems || Object.keys(selectedProducts).length === 0) return [];

    const result: PackagingItem[] = [];
    const selectedProductIds = Object.keys(selectedProducts);
    const totalQuantity = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);

    // Per-product packaging (applies to all perfumes)
    const perProductPackaging = packagingItems.filter(
      (p) => p.allocation_type === "per_product"
    );

    perProductPackaging.forEach((packaging) => {
      result.push({
        packaging_item_id: packaging.id,
        quantity: totalQuantity,
        is_auto_calculated: true,
        name: packaging.name,
        sku: packaging.sku,
        current_stock: packaging.current_stock,
      });
    });

    // Product-specific packaging
    const productSpecificPackaging = packagingItems.filter(
      (p) => p.allocation_type === "product_specific" && p.linked_product_ids
    );

    productSpecificPackaging.forEach((packaging) => {
      const linkedIds = packaging.linked_product_ids as string[];
      let matchedQuantity = 0;

      selectedProductIds.forEach((productId) => {
        if (linkedIds.includes(productId)) {
          matchedQuantity += selectedProducts[productId];
        }
      });

      if (matchedQuantity > 0) {
        result.push({
          packaging_item_id: packaging.id,
          quantity: matchedQuantity,
          is_auto_calculated: true,
          name: packaging.name,
          sku: packaging.sku,
          current_stock: packaging.current_stock,
        });
      }
    });

    return result;
  }, [selectedProducts, packagingItems]);

  // Available packaging for extra selection (exclude already auto-calculated)
  const availableExtraPackaging = useMemo(() => {
    if (!packagingItems) return [];
    const autoIds = new Set(autoCalculatedPackaging.map((p) => p.packaging_item_id));
    const extraIds = new Set(extraPackaging.map((p) => p.packaging_item_id));
    return packagingItems.filter(
      (p) => !autoIds.has(p.id) && !extraIds.has(p.id)
    );
  }, [packagingItems, autoCalculatedPackaging, extraPackaging]);

  const toggleProduct = (productId: string) => {
    setSelectedProducts((prev) => {
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
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: Math.max(1, quantity),
    }));
  };

  const addExtraPackaging = (packagingId: string) => {
    const packaging = packagingItems?.find((p) => p.id === packagingId);
    if (packaging) {
      setExtraPackaging((prev) => [
        ...prev,
        {
          packaging_item_id: packaging.id,
          quantity: 1,
          is_auto_calculated: false,
          name: packaging.name,
          sku: packaging.sku,
          current_stock: packaging.current_stock,
        },
      ]);
    }
  };

  const updateExtraPackagingQuantity = (packagingId: string, quantity: number) => {
    setExtraPackaging((prev) =>
      prev.map((p) =>
        p.packaging_item_id === packagingId
          ? { ...p, quantity: Math.max(1, quantity) }
          : p
      )
    );
  };

  const removeExtraPackaging = (packagingId: string) => {
    setExtraPackaging((prev) =>
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

      // Combine auto-calculated and extra packaging
      const allPackaging = [
        ...autoCalculatedPackaging.map((p) => ({
          packaging_item_id: p.packaging_item_id,
          quantity: p.quantity,
          is_auto_calculated: true,
        })),
        ...extraPackaging.map((p) => ({
          packaging_item_id: p.packaging_item_id,
          quantity: p.quantity,
          is_auto_calculated: false,
        })),
      ];

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
      setExtraPackaging([]);
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
      setExtraPackaging([]);
    }
  }, [open]);

  const totalProducts = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>New Stock Transfer Request</DialogTitle>
          <DialogDescription>
            Request to transfer stock and packaging between outlets
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* Products Selection */}
              <div className="space-y-2">
                <Label>Products * (Select one or more)</Label>
                <Card className="p-0">
                  <ScrollArea className="h-[180px]">
                    <div className="p-4 space-y-3">
                      {products?.map((product) => (
                        <div key={product.id} className="flex items-start gap-3">
                          <Checkbox
                            id={product.id}
                            checked={!!selectedProducts[product.id]}
                            onCheckedChange={() => toggleProduct(product.id)}
                          />
                          <div className="flex-1 space-y-2">
                            <Label htmlFor={product.id} className="cursor-pointer text-sm">
                              {product.name} <span className="text-muted-foreground">({product.sku})</span>
                            </Label>
                            {selectedProducts[product.id] && (
                              <Input
                                type="number"
                                min="1"
                                value={selectedProducts[product.id]}
                                onChange={(e) =>
                                  updateQuantity(product.id, parseInt(e.target.value) || 1)
                                }
                                placeholder="Quantity"
                                className="w-24 h-8"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
                {totalProducts > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {Object.keys(selectedProducts).length} product(s), {totalProducts} total units
                  </p>
                )}
              </div>

              {/* Auto-Calculated Packaging */}
              {autoCalculatedPackaging.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Auto-Included Packaging
                  </Label>
                  <Card className="p-4 bg-muted/50">
                    <div className="space-y-2">
                      {autoCalculatedPackaging.map((item) => (
                        <div
                          key={item.packaging_item_id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {item.name.toLowerCase().includes("box") ? (
                              <Box className="h-4 w-4 text-muted-foreground" />
                            ) : item.name.toLowerCase().includes("bag") ? (
                              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            ) : item.name.toLowerCase().includes("gift") ? (
                              <Gift className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Package className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span>{item.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              Auto
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">×{item.quantity}</span>
                            {item.current_stock < item.quantity && (
                              <Badge variant="destructive" className="text-xs">
                                Low Stock ({item.current_stock})
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Extra Packaging */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Extra Packaging (Optional)
                </Label>
                <Card className="p-4">
                  <div className="space-y-3">
                    {extraPackaging.map((item) => (
                      <div
                        key={item.packaging_item_id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateExtraPackagingQuantity(
                                item.packaging_item_id,
                                parseInt(e.target.value) || 1
                              )
                            }
                            className="w-20 h-8"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExtraPackaging(item.packaging_item_id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {availableExtraPackaging.length > 0 && (
                      <Select onValueChange={addExtraPackaging}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="+ Add extra packaging..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableExtraPackaging.map((packaging) => (
                            <SelectItem key={packaging.id} value={packaging.id}>
                              {packaging.name} ({packaging.sku}) - Stock: {packaging.current_stock}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </Card>
              </div>

              <Separator />

              {/* Outlet Selection */}
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
                          {outlet.name} ({outlet.outlet_type === "warehouse" ? "Warehouse" : "Outlet"})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {errors.to_outlet_id && (
                  <p className="text-sm text-destructive">{errors.to_outlet_id.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder="Additional notes for this transfer"
                  rows={2}
                />
                {errors.notes && (
                  <p className="text-sm text-destructive">{errors.notes.message}</p>
                )}
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="mt-4 pt-4 border-t">
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
