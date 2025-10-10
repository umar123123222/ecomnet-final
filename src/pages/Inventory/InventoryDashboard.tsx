import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Search, AlertTriangle, TrendingUp, DollarSign, Loader2, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Inventory, Outlet, Product } from "@/types/inventory";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { LowStockAlerts } from "@/components/inventory/LowStockAlerts";
import { RecentStockMovements } from "@/components/inventory/RecentStockMovements";

const InventoryDashboard = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);

  // Fetch products for the dialog
  const { data: products } = useQuery<Product[]>({
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

  // Fetch outlets
  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ["outlets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Outlet[];
    },
  });

  // Fetch inventory data
  const { data: inventory, isLoading } = useQuery<Inventory[]>({
    queryKey: ["inventory", selectedOutlet],
    queryFn: async () => {
      let query = supabase
        .from("inventory")
        .select(`
          *,
          product:products(*),
          outlet:outlets(*)
        `);

      if (selectedOutlet !== "all") {
        query = query.eq("outlet_id", selectedOutlet);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Inventory[];
    },
  });

  // Calculate summary stats
  const totalItems = inventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalValue = inventory?.reduce((sum, item) => 
    sum + (item.quantity * (item.product?.price || 0)), 0) || 0;
  const lowStockCount = inventory?.filter(item => 
    item.available_quantity <= (item.product?.reorder_level || 0)).length || 0;

  // Filter inventory by search term
  const filteredInventory = inventory?.filter(item =>
    item.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.product?.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Inventory Management
          </h1>
          <p className="text-muted-foreground">Track and manage stock across all outlets</p>
        </div>
        <Button onClick={() => setAdjustmentDialogOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" />
          Adjust Stock
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems}</div>
            <p className="text-xs text-muted-foreground">Across all outlets</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Retail value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory List</CardTitle>
          <CardDescription>View and search inventory items</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select outlet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outlets</SelectItem>
                {outlets?.map((outlet) => (
                  <SelectItem key={outlet.id} value={String(outlet.id)}>
                    {outlet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Inventory Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Outlet</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInventory && filteredInventory.length > 0 ? (
                    filteredInventory.map((item) => {
                      const isLowStock = item.available_quantity <= (item.product?.reorder_level || 0);
                      const isOutOfStock = item.available_quantity === 0;
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono text-sm">{item.product?.sku}</TableCell>
                          <TableCell className="font-medium">{item.product?.name}</TableCell>
                          <TableCell>{item.outlet?.name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{item.reserved_quantity}</TableCell>
                          <TableCell className="text-right font-medium">{item.available_quantity}</TableCell>
                          <TableCell className="text-right">{item.product?.reorder_level || 10}</TableCell>
                          <TableCell>
                            {isOutOfStock ? (
                              <Badge variant="destructive">Out of Stock</Badge>
                            ) : isLowStock ? (
                              <Badge variant="outline" className="border-orange-500 text-orange-500">
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
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No inventory items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts and Movements */}
      <div className="grid gap-6 md:grid-cols-2">
        <LowStockAlerts />
        <RecentStockMovements />
      </div>

      {/* Dialogs */}
      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        products={products || []}
        outlets={outlets || []}
      />
    </div>
  );
};

export default InventoryDashboard;
