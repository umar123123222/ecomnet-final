import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Package, Search, AlertTriangle, TrendingUp, DollarSign, Loader2, Settings, X, Save, Filter, PlayCircle, History, FileSpreadsheet, ArrowRight } from "lucide-react";
import { PageContainer, PageHeader, StatsCard, StatsGrid } from "@/components/layout";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { Inventory, Outlet, Product } from "@/types/inventory";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { BulkStockAdjustmentDialog } from "@/components/inventory/BulkStockAdjustmentDialog";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { LowStockAlerts } from "@/components/inventory/LowStockAlerts";
import { RecentStockMovements } from "@/components/inventory/RecentStockMovements";
import { RecentStockAdjustments } from "@/components/inventory/RecentStockAdjustments";
import { SmartReorderRecommendations } from "@/components/inventory/SmartReorderRecommendations";
import { SmartReorderSettings as SmartReorderGlobalSettings } from "@/components/inventory/SmartReorderGlobalSettings";
import { PackagingInventoryWidget } from "@/components/inventory/PackagingInventoryWidget";
import { ProductStockWidget } from "@/components/inventory/ProductStockWidget";
import { OutletStockWidget } from "@/components/inventory/OutletStockWidget";
import { PackagingLowStockAlerts } from "@/components/inventory/PackagingLowStockAlerts";
import { PendingTransfersWidget } from "@/components/inventory/PendingTransfersWidget";
import { QuickTransferDialog } from "@/components/inventory/QuickTransferDialog";
import { InventoryValueWidget } from "@/components/inventory/InventoryValueWidget";
import { StockAgingAnalysis } from "@/components/inventory/StockAgingAnalysis";
import { InventoryInsightsWidget } from "@/components/inventory/InventoryInsightsWidget";
import { DemandForecastWidget } from "@/components/inventory/DemandForecastWidget";
import { SalesVelocityTracker } from "@/components/inventory/SalesVelocityTracker";
import { ABCAnalysisWidget } from "@/components/inventory/ABCAnalysisWidget";
import { InventoryTurnoverWidget } from "@/components/inventory/InventoryTurnoverWidget";
import { OutletInventoryComparison } from "@/components/inventory/OutletInventoryComparison";
import { StockAvailabilityMatrix } from "@/components/inventory/StockAvailabilityMatrix";
import { InventoryReportGenerator } from "@/components/inventory/InventoryReportGenerator";
import { InventoryHealthScore } from "@/components/inventory/InventoryHealthScore";
import { QuickActionsPanel } from "@/components/inventory/QuickActionsPanel";
import { InventorySummaryWidget } from "@/components/inventory/InventorySummaryWidget";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilterPanel } from "@/components/AdvancedFilterPanel";
import { useUserRoles } from "@/hooks/useUserRoles";
import { BundleAvailabilityWidget } from "@/components/inventory/BundleAvailabilityWidget";

const InventoryDashboard = () => {
  const { user, profile } = useAuth();
  const { permissions, primaryRole } = useUserRoles();
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [bulkAdjustmentDialogOpen, setBulkAdjustmentDialogOpen] = useState(false);
  const [quickTransferDialogOpen, setQuickTransferDialogOpen] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [triggering, setTriggering] = useState(false);

  const isStoreManager = primaryRole === 'store_manager';
  const isWarehouseManager = primaryRole === 'warehouse_manager';
  const isOutletScoped = isStoreManager || isWarehouseManager;

  // Fetch the store/warehouse manager's assigned outlet
  const { data: userOutlet } = useQuery({
    queryKey: ["user-assigned-outlet", profile?.id],
    queryFn: async () => {
      if (!profile?.id || !isOutletScoped) return null;
      
      // First check if user is a manager of an outlet
      const { data: managedOutlet } = await supabase
        .from("outlets")
        .select("id, name")
        .eq("manager_id", profile.id)
        .eq("is_active", true)
        .single();

      if (managedOutlet) return managedOutlet;

      // Otherwise check outlet_staff assignment
      const { data: staffOutlet } = await supabase
        .from("outlet_staff")
        .select("outlet:outlets(id, name)")
        .eq("user_id", profile.id)
        .single();

      return staffOutlet?.outlet || null;
    },
    enabled: !!profile?.id && isOutletScoped,
  });

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

  // Fetch outlets - for store/warehouse managers, only show their outlet
  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ["outlets", isOutletScoped, userOutlet?.id],
    queryFn: async () => {
      let query = supabase
        .from("outlets")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      // Store/warehouse managers only see their outlet
      if (isOutletScoped && userOutlet?.id) {
        query = query.eq("id", userOutlet.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Outlet[];
    },
    enabled: !isOutletScoped || !!userOutlet,
  });


  // Fetch inventory data - filtered by outlet for store/warehouse managers
  const { data: inventory, isLoading } = useQuery<Inventory[]>({
    queryKey: ["inventory", isOutletScoped, userOutlet?.id],
    queryFn: async () => {
      let query = supabase
        .from("inventory")
        .select(`
          *,
          product:products(*),
          outlet:outlets(*)
        `);
      
      // Store/warehouse managers only see their outlet's inventory
      if (isOutletScoped && userOutlet?.id) {
        query = query.eq("outlet_id", userOutlet.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Inventory[];
    },
    enabled: !isOutletScoped || !!userOutlet,
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
    <PageContainer>
      <PageHeader
        title="Inventory Dashboard"
        description="Track and manage stock levels across outlets"
        icon={Package}
        actions={
          <>
            <Button
              onClick={handleTriggerAutomation}
              disabled={triggering}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <PlayCircle className="h-4 w-4" />
              {triggering ? 'Running...' : 'Run Smart Reorder'}
            </Button>
            <Link to="/automation-history">
              <Button variant="outline" size="sm" className="gap-2">
                <History className="h-4 w-4" />
                History
              </Button>
            </Link>
            {permissions.canCreateStockTransfer && (
              <Button
                onClick={() => setQuickTransferDialogOpen(true)}
                variant="secondary"
                size="sm"
                className="gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                Quick Transfer
              </Button>
            )}
            {permissions.canBulkAdjustStock && (
              <Button
                onClick={() => setBulkAdjustmentDialogOpen(true)}
                variant="secondary"
                size="sm"
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Bulk Adjustment
              </Button>
            )}
            {permissions.canAccessInventory && (
              <Button
                onClick={() => setAdjustmentDialogOpen(true)}
                size="sm"
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Stock Adjustment
              </Button>
            )}
          </>
        }
      />

      {/* Inventory Summary */}
      <InventorySummaryWidget />

      {/* Summary Cards */}
      <StatsGrid columns={3}>
        <StatsCard
          title="Total Items"
          value={totalItems.toLocaleString()}
          description="Across all outlets"
          icon={Package}
        />
        <StatsCard
          title="Total Value"
          value={`PKR ${totalValue.toLocaleString()}`}
          description="Inventory worth"
          icon={DollarSign}
          variant="info"
        />
        <StatsCard
          title="Low Stock Items"
          value={lowStockCount}
          description="Needs attention"
          icon={AlertTriangle}
          variant="warning"
        />
      </StatsGrid>

      {/* Inventory Table with Integrated Filters */}
      <Card>
        {/* Integrated Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-4 bg-muted/50 rounded-t-lg border-b">
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
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                      <TableHead>Type</TableHead>
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
                        const isBundle = item.product?.is_bundle;
                        
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">{item.product?.sku}</TableCell>
                            <TableCell className="font-medium">{item.product?.name}</TableCell>
                            <TableCell>
                              {isBundle ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="gap-1 cursor-help">
                                        📦 Bundle
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="text-xs">
                                        Bundle product - stock calculated from components
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Regular</Badge>
                              )}
                            </TableCell>
                            <TableCell>{item.outlet?.name}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{item.reserved_quantity}</TableCell>
                            <TableCell className="text-right font-medium">{item.available_quantity}</TableCell>
                            <TableCell className="text-right">{item.product?.reorder_level || 10}</TableCell>
                            <TableCell>
                              {isOutOfStock ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  Out of Stock
                                </Badge>
                              ) : isLowStock ? (
                                <Badge className="bg-warning/10 text-warning border-warning gap-1" variant="outline">
                                  <TrendingUp className="h-3 w-3" />
                                  Low Stock
                                </Badge>
                              ) : (
                                <Badge className="bg-success/10 text-success border-success gap-1" variant="outline">
                                  <Package className="h-3 w-3" />
                                  In Stock
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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

      {/* Smart Reorder and Adjustments */}
      <div className="grid gap-6 md:grid-cols-2">
        <SmartReorderRecommendations />
        <SmartReorderGlobalSettings />
      </div>

      {/* Health & Quick Actions */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <InventoryHealthScore />
        </div>
        <QuickActionsPanel
          onAddProduct={() => setProductDialogOpen(true)}
          onStockAdjustment={() => setAdjustmentDialogOpen(true)}
          onBulkAdjustment={() => setBulkAdjustmentDialogOpen(true)}
          onQuickTransfer={() => setQuickTransferDialogOpen(true)}
          permissions={{
            canAddProducts: permissions.canAccessInventory,
            canAdjustStock: permissions.canBulkAdjustStock,
            canBulkAdjustStock: permissions.canBulkAdjustStock,
            canCreateStockTransfer: permissions.canCreateStockTransfer,
          }}
        />
      </div>

      {/* Stock Overview - New Widgets */}
      <div className="grid gap-6 md:grid-cols-2">
        <ProductStockWidget />
        <OutletStockWidget />
      </div>

      {/* Recent Adjustments and Alerts */}
      <div className="grid gap-6 md:grid-cols-2">
        <RecentStockAdjustments />
        <LowStockAlerts />
      </div>

      {/* Recent Movements */}
      <RecentStockMovements />

      {/* Packaging Inventory Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <PackagingInventoryWidget />
        <PackagingLowStockAlerts />
      </div>

      {/* Stock Transfer Section */}
      <PendingTransfersWidget />

      {/* Advanced Analytics */}
      <div className="grid gap-6 md:grid-cols-3">
        <InventoryValueWidget />
        <StockAgingAnalysis />
        <InventoryInsightsWidget />
      </div>

      {/* Demand Planning & Forecasting */}
      <div className="grid gap-6 md:grid-cols-2">
        <DemandForecastWidget />
        <SalesVelocityTracker />
      </div>

      {/* Performance Analysis */}
      <div className="grid gap-6 md:grid-cols-2">
        <ABCAnalysisWidget />
        <InventoryTurnoverWidget />
      </div>

      {/* Multi-Outlet Analytics */}
      <div className="grid gap-6 md:grid-cols-2">
        <OutletInventoryComparison />
        <StockAvailabilityMatrix />
      </div>

      {/* Reporting & Export */}
      <InventoryReportGenerator />

      {/* Dialogs */}
      <StockAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        products={products || []}
        outlets={outlets || []}
      />

      <AddProductDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
      />

      <BulkStockAdjustmentDialog
        open={bulkAdjustmentDialogOpen}
        onOpenChange={setBulkAdjustmentDialogOpen}
      />

      <QuickTransferDialog
        open={quickTransferDialogOpen}
        onOpenChange={setQuickTransferDialogOpen}
        products={products || []}
        outlets={outlets || []}
      />
    </PageContainer>
  );
};

export default InventoryDashboard;
