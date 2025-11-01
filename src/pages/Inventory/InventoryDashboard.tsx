import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Search, AlertTriangle, TrendingUp, DollarSign, Loader2, Settings, X, Save, Filter, PlayCircle, History } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Inventory, Outlet, Product } from "@/types/inventory";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { LowStockAlerts } from "@/components/inventory/LowStockAlerts";
import { RecentStockMovements } from "@/components/inventory/RecentStockMovements";
import { SmartReorderRecommendations } from "@/components/inventory/SmartReorderRecommendations";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilterPanel } from "@/components/AdvancedFilterPanel";
import { useUserRoles } from "@/hooks/useUserRoles";

const InventoryDashboard = () => {
  const { user } = useAuth();
  const { permissions } = useUserRoles();
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [triggering, setTriggering] = useState(false);

  const handleTriggerAutomation = async () => {
    setTriggering(true);
    try {
      const { data, error } = await supabase.rpc('trigger_smart_reorder_now');
      
      if (error) {
        console.error('Error triggering automation:', error);
        toast.error('Failed to trigger smart reorder automation');
      } else {
        console.log('Automation triggered:', data);
        toast.success('Smart reorder automation triggered successfully! Check notifications for results.');
      }
    } catch (err) {
      console.error('Exception triggering automation:', err);
      toast.error('Failed to trigger automation');
    } finally {
      setTriggering(false);
    }
  };

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
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          *,
          product:products(*),
          outlet:outlets(*)
        `);
      if (error) throw error;
      return data as Inventory[];
    },
  });

  // Advanced filtering
  const {
    filters,
    filteredData: filteredInventory,
    updateFilter,
    updateCustomFilter,
    resetFilters,
    savedPresets,
    savePreset,
    loadPreset,
    deletePreset,
    activeFiltersCount,
  } = useAdvancedFilters(inventory || [], {
    searchFields: ['product.name', 'product.sku', 'outlet.name'],
    categoryField: 'product.category',
    customFilters: {
      outlet: (item, value) => item.outlet_id === value,
      stockStatus: (item, value) => {
        if (value === 'low') return item.available_quantity <= (item.product?.reorder_level || 0);
        if (value === 'out') return item.available_quantity === 0;
        if (value === 'in') return item.available_quantity > (item.product?.reorder_level || 0);
        return true;
      },
    },
  });

  // Calculate summary stats
  const totalItems = filteredInventory?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  const totalValue = filteredInventory?.reduce((sum, item) => 
    sum + (item.quantity * (item.product?.price || 0)), 0) || 0;
  const lowStockCount = filteredInventory?.filter(item => 
    item.available_quantity <= (item.product?.reorder_level || 0)).length || 0;

  // Get unique categories
  const categories = Array.from(new Set(inventory?.map(i => i.product?.category).filter(Boolean))) as string[];
  const categoryOptions = categories.map(cat => ({ value: cat, label: cat }));

  // Get outlet options
  const outletOptions = outlets?.map(outlet => ({ value: outlet.id, label: outlet.name })) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Inventory Dashboard
          </h1>
          <p className="text-muted-foreground">Track and manage stock levels across outlets</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleTriggerAutomation}
            disabled={triggering}
            variant="outline"
            className="gap-2"
          >
            <PlayCircle className="h-4 w-4" />
            {triggering ? 'Running...' : 'Run Smart Reorder'}
          </Button>
          <Link to="/automation-history">
            <Button variant="outline" className="gap-2">
              <History className="h-4 w-4" />
              Automation History
            </Button>
          </Link>
          {permissions.canAccessInventory && (
            <Button
              onClick={() => setAdjustmentDialogOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              Stock Adjustment
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalItems.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Across all outlets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">PKR {totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Inventory worth</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{lowStockCount}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table with Integrated Filters */}
      <Card>
        {/* Integrated Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-muted/30 rounded-t-lg border-b">
          {/* Left side - Quick filters */}
          <div className="flex flex-1 gap-3 flex-wrap items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search products, SKU, outlet..."
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
                className="h-9"
              />
            </div>
            
            {/* Category Filter */}
            <Select value={filters.category} onValueChange={(value) => updateFilter('category', value)}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoryOptions.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Stock Status Quick Filter */}
            <Select
              value={filters.customValues?.stockStatus || 'all'}
              onValueChange={(value) => updateCustomFilter('stockStatus', value)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock</SelectItem>
                <SelectItem value="in">In Stock</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="out">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Active filters badge */}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-9 px-3">
                {activeFiltersCount} filters
              </Badge>
            )}
          </div>
          
          {/* Right side - Advanced filters button */}
          <div className="flex gap-2">
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  More Filters
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Advanced Filters</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Outlet Filter */}
                  <div>
                    <Label>Outlet</Label>
                    <Select
                      value={filters.customValues?.outlet || 'all'}
                      onValueChange={(value) => updateCustomFilter('outlet', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All Outlets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Outlets</SelectItem>
                        {outletOptions.map(outlet => (
                          <SelectItem key={outlet.value} value={outlet.value}>
                            {outlet.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Saved Presets Section */}
                  {savedPresets.length > 0 && (
                    <div>
                      <Label>Saved Filter Presets</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {savedPresets.map(preset => (
                          <div key={preset.id} className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadPreset(preset.id)}
                            >
                              {preset.name}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deletePreset(preset.id)}
                              className="h-8 w-8 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Save Current Filters as Preset */}
                  {activeFiltersCount > 0 && (
                    <div className="pt-4 border-t">
                      <Label>Save Current Filters</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          placeholder="Preset name..."
                          value={presetName}
                          onChange={(e) => setPresetName(e.target.value)}
                        />
                        <Button onClick={() => {
                          if (presetName.trim()) {
                            savePreset(presetName);
                            setPresetName('');
                          }
                        }}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Table Content */}
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <>
              <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground border-b">
                Showing {filteredInventory?.length || 0} items
              </div>
              <div className="rounded-b-lg border-t-0">
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Smart Reorder Recommendations */}
      <SmartReorderRecommendations />

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
