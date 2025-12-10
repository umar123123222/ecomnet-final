import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Search, Package, TrendingDown, TrendingUp, AlertTriangle, Loader2, SlidersHorizontal, Box } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StockAdjustmentDialog } from "./StockAdjustmentDialog";
import { PackagingAdjustmentDialog } from "./PackagingAdjustmentDialog";

interface InventoryItem {
  id: string;
  quantity: number;
  product: {
    name: string;
    sku: string;
    reorder_level: number;
  };
}

interface StockMovement {
  id: string;
  movement_type: string;
  quantity: number;
  created_at: string;
  product: {
    name: string;
    sku: string;
  };
  created_by: {
    full_name: string;
  };
}

export const OutletInventoryView = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [packagingSearchQuery, setPackagingSearchQuery] = useState("");
  const [stockAdjustmentDialogOpen, setStockAdjustmentDialogOpen] = useState(false);
  const [packagingAdjustmentDialogOpen, setPackagingAdjustmentDialogOpen] = useState(false);
  const { profile } = useAuth();

  // Get user's assigned outlet
  const { data: userOutlet } = useQuery({
    queryKey: ["user-outlet", profile?.id],
    queryFn: async () => {
      // First check if user is an outlet manager
      const { data: managedOutlet } = await supabase
        .from("outlets")
        .select("id, name, outlet_type")
        .eq("manager_id", profile?.id)
        .single();

      if (managedOutlet) return managedOutlet;

      // Otherwise check outlet_staff assignment
      const { data: staffOutlet } = await supabase
        .from("outlet_staff")
        .select("outlet:outlets(id, name, outlet_type)")
        .eq("user_id", profile?.id)
        .single();

      return staffOutlet?.outlet || null;
    },
    enabled: !!profile?.id,
  });

  // Fetch inventory for the outlet
  const { data: inventory, isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ["outlet-inventory", userOutlet?.id, searchQuery],
    queryFn: async () => {
      if (!userOutlet?.id) return [];

      let query = supabase
        .from("inventory")
        .select(`
          id,
          quantity,
          product:products(name, sku, reorder_level)
        `)
        .eq("outlet_id", userOutlet.id);

      if (searchQuery) {
        query = query.or(`product.name.ilike.%${searchQuery}%,product.sku.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query.order("product(name)");
      if (error) throw error;
      return data as any;
    },
    enabled: !!userOutlet?.id,
  });

  // Fetch recent stock movements
  const { data: movements, isLoading: movementsLoading } = useQuery<StockMovement[]>({
    queryKey: ["outlet-movements", userOutlet?.id],
    queryFn: async () => {
      if (!userOutlet?.id) return [];

      const { data, error } = await supabase
        .from("stock_movements")
        .select(`
          id,
          movement_type,
          quantity,
          created_at,
          product:products(name, sku),
          created_by:profiles(full_name)
        `)
        .eq("outlet_id", userOutlet.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as any;
    },
    enabled: !!userOutlet?.id,
  });

  // Fetch products for stock adjustment dialog
  const { data: products = [] } = useQuery({
    queryKey: ["products-for-adjustment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch outlets for stock adjustment dialog (user's outlet only)
  const outlets = userOutlet ? [{ id: userOutlet.id, name: userOutlet.name }] : [];

  // Fetch packaging items for packaging adjustment dialog and display
  const { data: packagingItems = [], isLoading: packagingLoading } = useQuery({
    queryKey: ["packaging-items-for-outlet", packagingSearchQuery],
    queryFn: async () => {
      let query = supabase
        .from("packaging_items")
        .select("id, name, sku, current_stock, reorder_level")
        .eq("is_active", true);
      
      if (packagingSearchQuery) {
        query = query.or(`name.ilike.%${packagingSearchQuery}%,sku.ilike.%${packagingSearchQuery}%`);
      }
      
      const { data, error } = await query.order("name");
      if (error) throw error;
      return data;
    },
  });

  const lowPackagingCount = packagingItems.filter(item => 
    item.current_stock <= (item.reorder_level || 0)
  ).length;

  const lowStockCount = inventory?.filter(item => 
    item.quantity <= (item.product?.reorder_level || 0)
  ).length || 0;

  const getMovementBadge = (type: string, quantity: number) => {
    const isIncoming = quantity > 0;
    if (type === 'sale') {
      return <Badge variant="outline" className="border-red-500 text-red-500 gap-1">
        <TrendingDown className="h-3 w-3" />
        Sale
      </Badge>;
    }
    if (type === 'transfer_in' || type === 'restock') {
      return <Badge variant="outline" className="border-green-500 text-green-500 gap-1">
        <TrendingUp className="h-3 w-3" />
        {type === 'transfer_in' ? 'Transfer In' : 'Restock'}
      </Badge>;
    }
    if (type === 'transfer_out') {
      return <Badge variant="outline" className="border-orange-500 text-orange-500 gap-1">
        <TrendingDown className="h-3 w-3" />
        Transfer Out
      </Badge>;
    }
    return <Badge variant="outline">{type}</Badge>;
  };

  if (!userOutlet) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No outlet assigned to your account</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{userOutlet.name} Inventory</h2>
          <p className="text-muted-foreground">View and manage your outlet's stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setStockAdjustmentDialogOpen(true)} 
            variant="outline" 
            className="gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Adjust Product Stock
          </Button>
          <Button 
            onClick={() => setPackagingAdjustmentDialogOpen(true)} 
            variant="outline" 
            className="gap-2"
          >
            <Package className="h-4 w-4" />
            Adjust Packaging Stock
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventory?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Products</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Packaging Items</CardTitle>
            <Box className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{packagingItems.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Packaging</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowPackagingCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Inventory</CardTitle>
          <CardDescription>Product stock levels at your outlet</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {inventoryLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory && inventory.length > 0 ? (
                    inventory.map((item) => {
                      const isLowStock = item.quantity <= (item.product?.reorder_level || 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.product?.name}</div>
                              <div className="text-xs text-muted-foreground">{item.product?.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.quantity}</TableCell>
                          <TableCell>
                            {isLowStock ? (
                              <Badge variant="outline" className="border-yellow-500 text-yellow-500 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                In Stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No inventory found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Packaging Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Packaging Inventory</CardTitle>
          <CardDescription>Packaging stock levels</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search packaging..."
              value={packagingSearchQuery}
              onChange={(e) => setPackagingSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {packagingLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Packaging Item</TableHead>
                    <TableHead className="text-right">Stock Qty</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packagingItems.length > 0 ? (
                    packagingItems.map((item) => {
                      const isLowStock = item.current_stock <= (item.reorder_level || 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.sku}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.current_stock}</TableCell>
                          <TableCell>
                            {isLowStock ? (
                              <Badge variant="outline" className="border-yellow-500 text-yellow-500 gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                Low Stock
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-green-500 text-green-500">
                                In Stock
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No packaging items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stock Movements</CardTitle>
          <CardDescription>Last 10 inventory transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {movementsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements && movements.length > 0 ? (
                    movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell className="text-sm">
                          {new Date(movement.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{movement.product?.name}</div>
                            <div className="text-xs text-muted-foreground">{movement.product?.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getMovementBadge(movement.movement_type, movement.quantity)}</TableCell>
                        <TableCell className={`text-right font-medium ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                        </TableCell>
                        <TableCell>{movement.created_by?.full_name}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No recent movements
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stock Adjustment Dialogs */}
      <StockAdjustmentDialog
        open={stockAdjustmentDialogOpen}
        onOpenChange={setStockAdjustmentDialogOpen}
        products={products}
        outlets={outlets}
      />

      <PackagingAdjustmentDialog
        open={packagingAdjustmentDialogOpen}
        onOpenChange={setPackagingAdjustmentDialogOpen}
        packagingItems={packagingItems}
      />
    </div>
  );
};
