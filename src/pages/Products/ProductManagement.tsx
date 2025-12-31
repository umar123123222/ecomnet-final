import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Package, Search, Plus, Loader2, Edit, AlertCircle, CheckCircle, XCircle, Download, Trash2, RefreshCw, Filter, PackagePlus, SlidersHorizontal, DollarSign, Layers, Pencil, MapPin, ChevronDown, CheckSquare, Square, ListChecks, Boxes, Box } from "lucide-react";
import { PageContainer, PageHeader, StatsCard, StatsGrid } from "@/components/layout";
import { Product } from "@/types/inventory";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { SmartReorderSettings } from "@/components/inventory/SmartReorderSettings";
import { BulkStockAdditionDialog } from "@/components/inventory/BulkStockAdditionDialog";
import { StockAdjustmentDialog } from "@/components/inventory/StockAdjustmentDialog";
import { BulkEditProductsDialog } from "@/components/products/BulkEditProductsDialog";
import { InlineEditableCell } from "@/components/products/InlineEditableCell";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilterPanel } from "@/components/AdvancedFilterPanel";
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanelLegacy as BulkOperationsPanel } from '@/components/BulkOperationsPanelLegacy';
import { bulkToggleProducts, bulkUpdateProductCategory, exportToCSV, bulkDeleteProducts } from '@/utils/bulkOperations';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReservationDateFilter } from "@/hooks/useReservationDateFilter";
import { ReservationDateFilter } from "@/components/ReservationDateFilter";

const ProductManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions, primaryRole } = useUserRoles();
  const isFinanceUser = primaryRole === 'finance';
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [reorderSettingsOpen, setReorderSettingsOpen] = useState(false);
  const [reorderProduct, setReorderProduct] = useState<Product | null>(null);
  const [bulkStockDialogOpen, setBulkStockDialogOpen] = useState(false);
  const [stockAdjustmentDialogOpen, setStockAdjustmentDialogOpen] = useState(false);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [isSyncingShopify, setIsSyncingShopify] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");
  const { progress, executeBulkOperation } = useBulkOperations();
  
  // Date filter for reserved quantities
  const {
    dateRange,
    setDateRange,
    isFiltered: isDateFiltered,
    productReservations: filteredReservations,
    isLoadingProducts: isLoadingReservations,
    clearDateFilter
  } = useReservationDateFilter();

  // Fetch ALL products for filtering (no pagination here)
  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch inventory data aggregated by product (filtered by outlet if selected)
  const { data: inventoryData } = useQuery({
    queryKey: ["products-inventory-aggregated", selectedOutlet],
    queryFn: async () => {
      let query = supabase.from("inventory").select("product_id, quantity, reserved_quantity, outlet_id");
      
      if (selectedOutlet !== "all") {
        query = query.eq("outlet_id", selectedOutlet);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      const aggregated = data.reduce((acc: any, item: any) => {
        if (!acc[item.product_id]) {
          acc[item.product_id] = {
            total_quantity: 0,
            total_reserved: 0
          };
        }
        acc[item.product_id].total_quantity += item.quantity || 0;
        acc[item.product_id].total_reserved += item.reserved_quantity || 0;
        return acc;
      }, {});
      return aggregated;
    }
  });

  // Fetch suppliers for smart reorder
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('suppliers').select('id, name').eq('status', 'active').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch outlets for stock adjustment
  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets-active'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outlets').select('id, name').eq('is_active', true).order('name');
      if (error) throw error;
      return data;
    }
  });

  // Advanced filtering on ALL products
  const {
    filters,
    filteredData: filteredProducts,
    updateFilter,
    updateCustomFilter,
    resetFilters,
    savedPresets,
    savePreset,
    loadPreset,
    deletePreset,
    activeFiltersCount
  } = useAdvancedFilters(allProducts, {
    searchFields: ['name', 'sku', 'category', 'description'],
    categoryField: 'category',
    amountField: 'price',
    customFilters: {
      status: (product, value) => value === 'active' ? product.is_active : !product.is_active,
      isBundle: (product, value) => value === 'bundle' ? product.is_bundle === true : product.is_bundle !== true
    }
  });

  // Extract unique categories from all products
  const uniqueCategories = useMemo(() => {
    const categories = allProducts
      .map(p => p.category)
      .filter((c): c is string => Boolean(c));
    return [...new Set(categories)].sort();
  }, [allProducts]);

  // Paginate the filtered results
  const totalFiltered = filteredProducts?.length || 0;
  const totalPages = Math.ceil(totalFiltered / pageSize);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredProducts?.slice(start, end) || [];
  }, [filteredProducts, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useMemo(() => {
    if (currentPage > 1 && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalFiltered]);

  const activeProducts = filteredProducts?.filter(p => p.is_active).length || 0;
  const totalValue = filteredProducts?.reduce((sum, p) => sum + (p.price || 0), 0) || 0;

  // Get unique categories from ALL products
  const categories = Array.from(new Set(allProducts?.map(p => p.category).filter(Boolean))) as string[];
  const categoryOptions = categories.map(cat => ({
    value: cat,
    label: cat
  }));

  // Bulk operations
  const bulkOperations: BulkOperation[] = [...(permissions.canManageProducts ? [{
    id: 'activate',
    label: 'Activate',
    icon: CheckCircle,
    action: async (ids: string[]) => bulkToggleProducts(ids, true)
  }, {
    id: 'deactivate',
    label: 'Deactivate',
    icon: XCircle,
    variant: 'destructive' as const,
    action: async (ids: string[]) => bulkToggleProducts(ids, false),
    requiresConfirmation: true,
    confirmMessage: 'Are you sure you want to deactivate the selected products? They will no longer be available for orders.'
  }, {
    id: 'bulk-edit',
    label: 'Bulk Edit',
    icon: Pencil,
    action: async () => {
      setBulkEditDialogOpen(true);
      return { success: 0, failed: 0 };
    }
  }, {
    id: 'delete',
    label: 'Delete Products',
    icon: Trash2,
    variant: 'destructive' as const,
    action: async (ids: string[]) => bulkDeleteProducts(ids),
    requiresConfirmation: true,
    confirmMessage: 'Are you sure you want to permanently delete the selected products? This action cannot be undone.'
  }] : []), {
    id: 'export',
    label: 'Export Selected',
    icon: Download,
    action: async ids => {
      const selectedProductsData = allProducts?.filter(p => ids.includes(p.id)) || [];
      exportToCSV(selectedProductsData, `products-${new Date().toISOString().split('T')[0]}`);
      return {
        success: ids.length,
        failed: 0
      };
    }
  }];

  const handleBulkOperation = (operation: BulkOperation) => {
    // Don't clear selection for bulk-edit as the dialog needs the selection
    if (operation.id === 'bulk-edit') {
      executeBulkOperation(operation, selectedProducts);
      return;
    }
    executeBulkOperation(operation, selectedProducts, () => {
      setSelectedProducts([]);
      queryClient.invalidateQueries({ queryKey: ["products-all"] });
    });
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  // Selection handlers
  const handleSelectNone = () => {
    setSelectedProducts([]);
  };

  const handleSelectThisPage = () => {
    const pageIds = paginatedProducts.map(p => p.id);
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      pageIds.forEach(id => newSet.add(id));
      return Array.from(newSet);
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedProducts(filteredProducts?.map(p => p.id) || []);
  };

  // Check selection state for current page
  const allPageSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedProducts.includes(p.id));
  const somePageSelected = paginatedProducts.some(p => selectedProducts.includes(p.id)) && !allPageSelected;

  const handleSyncFromShopify = async () => {
    setIsSyncingShopify(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-products');
      if (error) throw error;
      toast({
        title: 'Sync Started',
        description: 'Products are being synced from Shopify. This may take a few moments.'
      });

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["products-all"] });
        toast({
          title: 'Sync Complete',
          description: 'Products have been synced successfully from Shopify.'
        });
      }, 3000);
    } catch (error: any) {
      toast({
        title: 'Sync Failed',
        description: error.message || 'Failed to sync products from Shopify',
        variant: 'destructive'
      });
    } finally {
      setIsSyncingShopify(false);
    }
  };

  // Inline edit handler
  const handleInlineUpdate = async (productId: string, field: string, value: string | number) => {
    const { error } = await supabase
      .from('products')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', productId);
    
    if (error) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive'
      });
      throw error;
    }
    
    toast({
      title: 'Updated',
      description: `Product ${field} updated successfully`
    });
    
    queryClient.invalidateQueries({ queryKey: ["products-all"] });
  };

  return (
    <PageContainer>
      <PageHeader 
        title="Product Management" 
        description="Manage your product catalog" 
        icon={Package} 
        actions={
          <>
            {!isFinanceUser && (
              <Button onClick={handleSyncFromShopify} disabled={isSyncingShopify} variant="outline" className="gap-2">
                {isSyncingShopify ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync from Shopify
              </Button>
            )}
            {permissions.canManageProducts && (
              <>
                <Button onClick={() => setStockAdjustmentDialogOpen(true)} variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Adjust Stock
                </Button>
                
                <Button onClick={() => {
                  setSelectedProduct(null);
                  setProductDialogOpen(true);
                }} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </>
            )}
          </>
        } 
      />

      {/* Summary Cards */}
      <StatsGrid columns={3}>
        <StatsCard title="Total Products" value={allProducts?.length || 0} description={`${activeProducts} active`} icon={Package} />
        <StatsCard title="Categories" value={new Set(allProducts?.map(p => p.category)).size} description="Unique categories" icon={Layers} />
        <StatsCard title="Avg. Price" value={`Rs. ${allProducts && allProducts.length > 0 ? Math.round(totalValue / allProducts.length) : 0}`} description="Average product price" icon={DollarSign} />
      </StatsGrid>

      {/* Bulk Operations Panel */}
      {selectedProducts.length > 0 && (
        <BulkOperationsPanel 
          selectedCount={selectedProducts.length} 
          operations={bulkOperations} 
          onExecute={handleBulkOperation} 
          progress={progress} 
        />
      )}

      {/* Products List */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Product Catalog</CardTitle>
              <CardDescription>View and manage all products</CardDescription>
            </div>
          </div>
          
          {/* Search and Filter Bar */}
          <div className="flex flex-col gap-4 mt-4">
            {/* Search Row */}
            <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center w-full">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by name, SKU, category, description..." 
                  value={filters.search || ''} 
                  onChange={e => updateFilter('search', e.target.value)} 
                  className="pl-10 h-10" 
                />
              </div>
              
              {activeFiltersCount > 0 && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="gap-2 shrink-0">
                  <XCircle className="h-4 w-4" />
                  Clear {activeFiltersCount} Filter{activeFiltersCount > 1 ? 's' : ''}
                </Button>
              )}
            </div>
            
            {/* Filters Row */}
            <div className="flex flex-wrap gap-2 items-center">
              <Select 
                value={filters.customValues?.status || 'all'} 
                onValueChange={value => {
                  if (value === 'all') {
                    updateCustomFilter('status', undefined);
                  } else {
                    updateCustomFilter('status', value);
                  }
                }}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <Filter className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.customValues?.isBundle || 'all'} 
                onValueChange={value => {
                  if (value === 'all') {
                    updateCustomFilter('isBundle', undefined);
                  } else {
                    updateCustomFilter('isBundle', value);
                  }
                }}
              >
                <SelectTrigger className="w-[140px] h-9">
                  <Boxes className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bundle">
                    <span className="flex items-center gap-2">
                      <Boxes className="h-3.5 w-3.5" />
                      Bundles Only
                    </span>
                  </SelectItem>
                  <SelectItem value="single">
                    <span className="flex items-center gap-2">
                      <Box className="h-3.5 w-3.5" />
                      Single Products
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={filters.category || 'all'} 
                onValueChange={value => updateFilter('category', value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-[160px] h-9">
                  <Layers className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                <SelectTrigger className="w-[160px] h-9">
                  <MapPin className="h-4 w-4 mr-2 shrink-0" />
                  <SelectValue placeholder="Outlet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets</SelectItem>
                  {outlets.map((outlet: any) => (
                    <SelectItem key={outlet.id} value={outlet.id}>{outlet.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ReservationDateFilter
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onClear={clearDateFilter}
                isLoading={isLoadingReservations}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isFinanceUser && (
                      <TableHead className="w-12">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              {allPageSelected ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : somePageSelected ? (
                                <ListChecks className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={handleSelectNone}>
                              <Square className="h-4 w-4 mr-2" />
                              Select None
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleSelectThisPage}>
                              <CheckSquare className="h-4 w-4 mr-2" />
                              Select This Page ({paginatedProducts.length})
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSelectAllFiltered}>
                              <ListChecks className="h-4 w-4 mr-2" />
                              Select All ({totalFiltered} filtered)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableHead>
                    )}
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Retail Price</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead>Status</TableHead>
                    {!isFinanceUser && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProducts.length > 0 ? paginatedProducts.map(product => (
                    <TableRow key={product.id}>
                      {!isFinanceUser && (
                        <TableCell>
                          <Checkbox 
                            checked={selectedProducts.includes(product.id)} 
                            onCheckedChange={() => handleSelectProduct(product.id)} 
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={product.name}>{product.name}</TableCell>
                      <TableCell>
                        {product.is_bundle ? (
                          <Badge variant="secondary" className="gap-1">
                            <Boxes className="h-3 w-3" />
                            Bundle
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Box className="h-3 w-3" />
                            Single
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {permissions.canManageProducts ? (
                          <InlineEditableCell
                            value={product.category || ''}
                            onSave={(val) => handleInlineUpdate(product.id, 'category', val)}
                            type="select"
                            options={[
                              ...categoryOptions,
                              { value: '__add_new__', label: '+ Add New Category' }
                            ]}
                            placeholder="Uncategorized"
                            disabled={isFinanceUser}
                            formatDisplay={(val) => val ? String(val) : 'Uncategorized'}
                          />
                        ) : (
                          <Badge variant="outline">{product.category || 'Uncategorized'}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {permissions.canManageProducts ? (
                          <InlineEditableCell
                            value={product.cost ?? 0}
                            onSave={(val) => handleInlineUpdate(product.id, 'cost', val)}
                            type="number"
                            prefix="Rs. "
                            disabled={isFinanceUser}
                            formatDisplay={(val) => `Rs. ${(val as number)?.toLocaleString() || '0'}`}
                          />
                        ) : (
                          <span>Rs. {product.cost?.toLocaleString() || '0'}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {permissions.canManageProducts ? (
                          <InlineEditableCell
                            value={product.price ?? 0}
                            onSave={(val) => handleInlineUpdate(product.id, 'price', val)}
                            type="number"
                            prefix="Rs. "
                            disabled={isFinanceUser}
                            formatDisplay={(val) => `Rs. ${(val as number)?.toLocaleString() || '0'}`}
                          />
                        ) : (
                          <span>Rs. {product.price?.toLocaleString()}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">
                          {inventoryData?.[product.id]?.total_quantity || 0}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {isDateFiltered ? (
                          <span className="text-primary font-medium">
                            {filteredReservations?.get(product.id) || 0}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {inventoryData?.[product.id]?.total_reserved || 0}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDateFiltered ? (
                          <span className="font-medium text-primary">
                            {(inventoryData?.[product.id]?.total_quantity || 0) - (filteredReservations?.get(product.id) || 0)}
                          </span>
                        ) : (
                          <span className="font-medium text-primary">
                            {(inventoryData?.[product.id]?.total_quantity || 0) - (inventoryData?.[product.id]?.total_reserved || 0)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {product.is_active ? (
                          <Badge variant="outline" className="border-green-500 text-green-500">Active</Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-500 text-gray-500">Inactive</Badge>
                        )}
                      </TableCell>
                      {!isFinanceUser && (
                        <TableCell className="text-right">
                          {permissions.canManageProducts && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="gap-2" 
                              onClick={() => {
                                setSelectedProduct(product);
                                setProductDialogOpen(true);
                              }}
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={isFinanceUser ? 11 : 12} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Package className="h-10 w-10 opacity-40" />
                          <p className="font-medium">No products found</p>
                          <p className="text-sm">Try adjusting your filters or add a new product</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedProducts.length > 0 && (
              <span className="font-medium text-foreground mr-2">
                {selectedProducts.length} selected
                {selectedProducts.length > paginatedProducts.length && ' (across pages)'}
              </span>
            )}
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalFiltered)} to {Math.min(currentPage * pageSize, totalFiltered)} of {totalFiltered.toLocaleString()} products
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
              disabled={currentPage === 1 || isLoading}
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                let pageNumber: number;
                if (totalPages <= 5) {
                  pageNumber = idx + 1;
                } else if (currentPage <= 3) {
                  pageNumber = idx + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + idx;
                } else {
                  pageNumber = currentPage - 2 + idx;
                }
                if (pageNumber < 1 || pageNumber > totalPages) return null;
                return (
                  <Button 
                    key={pageNumber} 
                    variant={currentPage === pageNumber ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setCurrentPage(pageNumber)} 
                    disabled={isLoading}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
              disabled={currentPage === totalPages || totalPages === 0 || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      <AddProductDialog 
        open={productDialogOpen} 
        onOpenChange={open => {
          setProductDialogOpen(open);
          if (!open) setSelectedProduct(null);
        }} 
        product={selectedProduct} 
      />

      <Dialog open={reorderSettingsOpen} onOpenChange={setReorderSettingsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Smart Reorder Settings</DialogTitle>
          </DialogHeader>
          {reorderProduct && (
            <SmartReorderSettings 
              item={reorderProduct} 
              itemType="product" 
              suppliers={suppliers} 
              onUpdate={() => setReorderSettingsOpen(false)} 
            />
          )}
        </DialogContent>
      </Dialog>

      <BulkStockAdditionDialog open={bulkStockDialogOpen} onOpenChange={setBulkStockDialogOpen} products={allProducts} />

      <StockAdjustmentDialog open={stockAdjustmentDialogOpen} onOpenChange={setStockAdjustmentDialogOpen} products={allProducts} outlets={outlets} />

      <BulkEditProductsDialog 
        open={bulkEditDialogOpen} 
        onOpenChange={setBulkEditDialogOpen} 
        selectedProductIds={selectedProducts}
        categories={categories}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["products-all"] });
        }}
      />
    </PageContainer>
  );
};

export default ProductManagement;
