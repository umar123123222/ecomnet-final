import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Package, Box } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface SupplierProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
}

export function SupplierProductsDialog({ open, onOpenChange, supplierId, supplierName }: SupplierProductsDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [selectedPackaging, setSelectedPackaging] = useState<Set<string>>(new Set());
  const [productCosts, setProductCosts] = useState<Record<string, number>>({});
  const [productMOQs, setProductMOQs] = useState<Record<string, number>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: packagingItems = [] } = useQuery({
    queryKey: ["packaging-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("packaging_items")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: existingAssignments = [] } = useQuery({
    queryKey: ["supplier-products", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("supplier_id", supplierId);
      if (error) throw error;
      return data;
    },
    enabled: !!supplierId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const assignments: any[] = [];
      
      // Add product assignments
      selectedProducts.forEach((productId) => {
        assignments.push({
          supplier_id: supplierId,
          product_id: productId,
          packaging_item_id: null,
          unit_cost: productCosts[productId] || 0,
          minimum_order_quantity: productMOQs[productId] || 1,
        });
      });

      // Add packaging assignments
      selectedPackaging.forEach((packagingId) => {
        assignments.push({
          supplier_id: supplierId,
          product_id: null,
          packaging_item_id: packagingId,
          unit_cost: productCosts[packagingId] || 0,
          minimum_order_quantity: productMOQs[packagingId] || 1,
        });
      });

      // Delete existing assignments
      await supabase
        .from("supplier_products")
        .delete()
        .eq("supplier_id", supplierId);

      // Insert new assignments
      if (assignments.length > 0) {
        const { error } = await supabase
          .from("supplier_products")
          .insert(assignments);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-products"] });
      toast({ title: "Product assignments updated successfully" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error updating assignments",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPackaging = packagingItems.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleProduct = (productId: string) => {
    const newSet = new Set(selectedProducts);
    if (newSet.has(productId)) {
      newSet.delete(productId);
    } else {
      newSet.add(productId);
      // Pre-fill unit cost from product price if not already set
      const product = products.find((p: any) => p.id === productId);
      if (product && !productCosts[productId]) {
        setProductCosts((prev) => ({ ...prev, [productId]: product.price || 0 }));
      }
    }
    setSelectedProducts(newSet);
  };

  const handleTogglePackaging = (packagingId: string) => {
    const newSet = new Set(selectedPackaging);
    if (newSet.has(packagingId)) {
      newSet.delete(packagingId);
    } else {
      newSet.add(packagingId);
      // Pre-fill unit cost from packaging item cost if not already set
      const item = packagingItems.find((p: any) => p.id === packagingId);
      if (item && !productCosts[packagingId]) {
        setProductCosts((prev) => ({ ...prev, [packagingId]: item.cost || 0 }));
      }
    }
    setSelectedPackaging(newSet);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Products & Packaging - {supplierName}</DialogTitle>
          <DialogDescription>
            Select products and packaging items supplied by this vendor, and set unit costs and MOQs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <Tabs defaultValue="products" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products">
              <Package className="mr-2 h-4 w-4" />
              Products ({selectedProducts.size})
            </TabsTrigger>
            <TabsTrigger value="packaging">
              <Box className="mr-2 h-4 w-4" />
              Packaging ({selectedPackaging.size})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="flex-1 overflow-y-auto mt-4 space-y-2">
            {filteredProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No products found</p>
            ) : (
              filteredProducts.map((product: any) => (
                <div key={product.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={selectedProducts.has(product.id)}
                    onCheckedChange={() => handleToggleProduct(product.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{product.name}</p>
                      <Badge variant="outline" className="text-xs">{product.sku}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Price: PKR {product.price.toFixed(2)}
                      {product.size && ` • ${product.size}${product.unit_type ? ` ${product.unit_type}` : ''}`}
                    </p>
                    {selectedProducts.has(product.id) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Unit Cost (PKR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={productCosts[product.id] || ""}
                            onChange={(e) =>
                              setProductCosts({ ...productCosts, [product.id]: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">MOQ</Label>
                          <Input
                            type="number"
                            placeholder="1"
                            value={productMOQs[product.id] || ""}
                            onChange={(e) =>
                              setProductMOQs({ ...productMOQs, [product.id]: parseInt(e.target.value) || 1 })
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="packaging" className="flex-1 overflow-y-auto mt-4 space-y-2">
            {filteredPackaging.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No packaging items found</p>
            ) : (
              filteredPackaging.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                  <Checkbox
                    checked={selectedPackaging.has(item.id)}
                    onCheckedChange={() => handleTogglePackaging(item.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{item.name}</p>
                      <Badge variant="outline" className="text-xs capitalize">{item.type}</Badge>
                      <Badge variant="outline" className="text-xs">{item.sku}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Cost: PKR {item.cost.toFixed(2)} • Stock: {item.current_stock}
                      {item.size && ` • ${item.size}`}
                    </p>
                    {selectedPackaging.has(item.id) && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Unit Cost (PKR)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={productCosts[item.id] || ""}
                            onChange={(e) =>
                              setProductCosts({ ...productCosts, [item.id]: parseFloat(e.target.value) || 0 })
                            }
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">MOQ</Label>
                          <Input
                            type="number"
                            placeholder="1"
                            value={productMOQs[item.id] || ""}
                            onChange={(e) =>
                              setProductMOQs({ ...productMOQs, [item.id]: parseInt(e.target.value) || 1 })
                            }
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Save Assignments ({selectedProducts.size + selectedPackaging.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
