import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Plus } from "lucide-react";
import { Product } from "@/types/inventory";
import { useAuth } from "@/contexts/AuthContext";

interface BulkStockAdditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

export function BulkStockAdditionDialog({ open, onOpenChange, products }: BulkStockAdditionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Fetch main warehouse
  const { data: mainWarehouse } = useQuery({
    queryKey: ['main-warehouse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('outlet_type', 'warehouse')
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  // Reset selections when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedProducts({});
      setSearchTerm("");
    }
  }, [open]);

  const filteredProducts = products.filter(product => 
    product.is_active && (
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleToggleProduct = (productId: string) => {
    setSelectedProducts(prev => {
      const updated = { ...prev };
      if (updated[productId]) {
        delete updated[productId];
      } else {
        updated[productId] = 1;
      }
      return updated;
    });
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedProducts(prev => ({
      ...prev,
      [productId]: Math.max(0, quantity)
    }));
  };

  const handleSubmit = async () => {
    if (!mainWarehouse) {
      toast({
        title: "Error",
        description: "Main warehouse not found. Please create a warehouse outlet first.",
        variant: "destructive",
      });
      return;
    }

    const selectedCount = Object.keys(selectedProducts).length;
    if (selectedCount === 0) {
      toast({
        title: "Error",
        description: "Please select at least one product",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const [productId, quantityToAdd] of Object.entries(selectedProducts)) {
        if (quantityToAdd <= 0) continue;

        try {
          // Check if inventory record exists
          const { data: existingInventory } = await supabase
            .from('inventory')
            .select('id, quantity')
            .eq('product_id', productId)
            .eq('outlet_id', mainWarehouse.id)
            .single();

          if (existingInventory) {
            // Update existing inventory
            const { error: updateError } = await supabase
              .from('inventory')
              .update({ 
                quantity: existingInventory.quantity + quantityToAdd,
                last_restocked_at: new Date().toISOString()
              })
              .eq('id', existingInventory.id);

            if (updateError) throw updateError;
          } else {
            // Insert new inventory record
            const { error: insertError } = await supabase
              .from('inventory')
              .insert({
                product_id: productId,
                outlet_id: mainWarehouse.id,
                quantity: quantityToAdd,
                reserved_quantity: 0,
                last_restocked_at: new Date().toISOString()
              });

            if (insertError) throw insertError;
          }

          // Create stock movement record
          await supabase
            .from('stock_movements')
            .insert({
              product_id: productId,
              outlet_id: mainWarehouse.id,
              movement_type: 'purchase',
              quantity: quantityToAdd,
              notes: 'Bulk stock addition',
              created_by: user?.id
            });

          successCount++;
        } catch (error) {
          console.error(`Error adding stock for product ${productId}:`, error);
          errorCount++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["products-inventory-aggregated"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });

      toast({
        title: "Stock Added",
        description: `Successfully added stock for ${successCount} product${successCount !== 1 ? 's' : ''}${errorCount > 0 ? `. Failed: ${errorCount}` : ''}`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add stock",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(selectedProducts).length;
  const totalQuantity = Object.values(selectedProducts).reduce((sum, qty) => sum + qty, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Stock to Main Warehouse</DialogTitle>
          <DialogDescription>
            {mainWarehouse ? `Adding stock to: ${mainWarehouse.name}` : 'Loading warehouse...'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
            <Package className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          {/* Selected Summary */}
          {selectedCount > 0 && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="font-medium">{selectedCount}</span> product{selectedCount !== 1 ? 's' : ''} selected
              {totalQuantity > 0 && (
                <span className="text-muted-foreground"> • Total quantity: <span className="font-medium">{totalQuantity}</span></span>
              )}
            </div>
          )}

          {/* Product List */}
          <ScrollArea className="h-[400px] rounded-md border">
            <div className="p-4 space-y-2">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active products found
                </p>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = !!selectedProducts[product.id];
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        isSelected ? 'bg-muted/50 border-primary' : 'hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleProduct(product.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {product.sku && <span className="font-mono">{product.sku}</span>}
                          {product.category && (
                            <span className="ml-2">• {product.category}</span>
                          )}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`qty-${product.id}`} className="text-sm whitespace-nowrap">
                            Quantity:
                          </Label>
                          <Input
                            id={`qty-${product.id}`}
                            type="number"
                            min="0"
                            value={selectedProducts[product.id] || 0}
                            onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value) || 0)}
                            className="w-24"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || selectedCount === 0 || !mainWarehouse}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Stock to {selectedCount} Product{selectedCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
