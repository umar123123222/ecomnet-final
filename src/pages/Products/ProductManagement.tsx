import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Search, Plus, Loader2, Edit, AlertCircle, CheckCircle, XCircle, Download, ScanBarcode, Printer, Trash2 } from "lucide-react";
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import { Product } from "@/types/inventory";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { SmartReorderSettings } from "@/components/inventory/SmartReorderSettings";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilterPanel } from "@/components/AdvancedFilterPanel";
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanelLegacy as BulkOperationsPanel } from '@/components/BulkOperationsPanelLegacy';
import { bulkToggleProducts, bulkUpdateProductCategory, exportToCSV, bulkDeleteProducts } from '@/utils/bulkOperations';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from '@/hooks/useUserRoles';

const ProductManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions } = useUserRoles();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningProductId, setScanningProductId] = useState<string | null>(null);
  const [reorderSettingsOpen, setReorderSettingsOpen] = useState(false);
  const [reorderProduct, setReorderProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const { progress, executeBulkOperation } = useBulkOperations();


  // Fetch products with pagination
  const { data: productsData, isLoading } = useQuery({
    queryKey: ["products", currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const [countResult, dataResult] = await Promise.all([
        supabase.from("products").select("*", { count: 'exact', head: true }),
        supabase
          .from("products")
          .select("*")
          .order("name")
          .range(from, to)
      ]);

      if (dataResult.error) throw dataResult.error;
      
      return {
        products: dataResult.data || [],
        totalCount: countResult.count || 0
      };
    },
  });

  const products = productsData?.products || [];
  const totalCount = productsData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Fetch inventory data aggregated by product
  const { data: inventoryData } = useQuery({
    queryKey: ["products-inventory-aggregated"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("product_id, quantity, reserved_quantity");
      if (error) throw error;
      
      // Aggregate by product_id
      const aggregated = data.reduce((acc: any, item: any) => {
        if (!acc[item.product_id]) {
          acc[item.product_id] = {
            total_quantity: 0,
            total_reserved: 0,
          };
        }
        acc[item.product_id].total_quantity += item.quantity || 0;
        acc[item.product_id].total_reserved += item.reserved_quantity || 0;
        return acc;
      }, {});
      
      return aggregated;
    },
  });

  // Fetch suppliers for smart reorder
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Advanced filtering
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
    activeFiltersCount,
  } = useAdvancedFilters(products || [], {
    searchFields: ['name', 'sku', 'category', 'description'],
    categoryField: 'category',
    amountField: 'price',
    customFilters: {
      status: (product, value) => value === 'active' ? product.is_active : !product.is_active,
    },
  });

  const activeProducts = filteredProducts?.filter(p => p.is_active).length || 0;
  const totalValue = filteredProducts?.reduce((sum, p) => sum + (p.price || 0), 0) || 0;

  // Get unique categories
  const categories = Array.from(new Set(products?.map(p => p.category).filter(Boolean))) as string[];
  const categoryOptions = categories.map(cat => ({ value: cat, label: cat }));

  // Bulk operations
  const bulkOperations: BulkOperation[] = [
    ...(permissions.canManageProducts ? [
      {
        id: 'activate',
        label: 'Activate',
        icon: CheckCircle,
        action: async (ids: string[]) => bulkToggleProducts(ids, true),
      },
      {
        id: 'deactivate',
        label: 'Deactivate',
        icon: XCircle,
        variant: 'destructive' as const,
        action: async (ids: string[]) => bulkToggleProducts(ids, false),
        requiresConfirmation: true,
        confirmMessage: 'Are you sure you want to deactivate the selected products? They will no longer be available for orders.',
      },
      {
        id: 'delete',
        label: 'Delete Products',
        icon: Trash2,
        variant: 'destructive' as const,
        action: async (ids: string[]) => bulkDeleteProducts(ids),
        requiresConfirmation: true,
        confirmMessage: 'Are you sure you want to permanently delete the selected products? This action cannot be undone.',
      },
    ] : []),
    {
      id: 'export',
      label: 'Export Selected',
      icon: Download,
      action: async (ids) => {
        const selectedProductsData = products?.filter(p => ids.includes(p.id)) || [];
        exportToCSV(selectedProductsData, `products-${new Date().toISOString().split('T')[0]}`);
        return { success: ids.length, failed: 0 };
      },
    },
  ];

  const handleBulkOperation = (operation: BulkOperation) => {
    executeBulkOperation(operation, selectedProducts, () => {
      setSelectedProducts([]);
      // Refetch products after bulk operations
      queryClient.invalidateQueries({ queryKey: ["products"] });
    });
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    setSelectedProducts(
      selectedProducts.length === filteredProducts?.length 
        ? [] 
        : filteredProducts?.map(p => p.id) || []
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Product Management
          </h1>
          <p className="text-muted-foreground">Manage your product catalog</p>
        </div>
        {permissions.canManageProducts && (
          <Button
            onClick={() => {
              setSelectedProduct(null);
              setProductDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products?.length || 0}</div>
            <p className="text-xs text-muted-foreground">{activeProducts} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(products?.map(p => p.category)).size}
            </div>
            <p className="text-xs text-muted-foreground">Unique categories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Price</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rs. {products && products.length > 0 ? Math.round(totalValue / products.length) : 0}
            </div>
            <p className="text-xs text-muted-foreground">Average product price</p>
          </CardContent>
        </Card>
      </div>

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
          <CardTitle>Product Catalog</CardTitle>
          <CardDescription>View and manage all products</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedProducts.length === filteredProducts?.length && filteredProducts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Barcode</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts && filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={() => handleSelectProduct(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {(product as any).barcode || (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setScanningProductId(product.id);
                                setScannerOpen(true);
                              }}
                            >
                              <ScanBarcode className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category || 'Uncategorized'}</Badge>
                        </TableCell>
                        <TableCell className="text-right">Rs. {product.price?.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            {inventoryData?.[product.id]?.total_quantity || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">
                            {inventoryData?.[product.id]?.total_reserved || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {product.is_active ? (
                            <Badge variant="outline" className="border-green-500 text-green-500">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-gray-500 text-gray-500">
                              Inactive
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setReorderProduct(product);
                                setReorderSettingsOpen(true);
                              }}
                            >
                              Smart Reorder
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                window.open(`/production/labels?product=${product.id}&type=finished_product`, '_blank');
                              }}
                            >
                              <Printer className="h-3 w-3" />
                              Labels
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                   ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No products found
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
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalCount)} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} products
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
              disabled={currentPage === totalPages || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      <AddProductDialog
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        product={selectedProduct}
      />

      <BarcodeScanner
        isOpen={scannerOpen}
        onClose={() => {
          setScannerOpen(false);
          setScanningProductId(null);
        }}
        onScan={async (result) => {
          if (scanningProductId) {
            const { error } = await supabase
              .from('products')
              .update({ barcode: result.barcode })
              .eq('id', scanningProductId);
            
            if (!error) {
              toast({
                title: 'Barcode Added',
                description: `Barcode ${result.barcode} assigned to product`,
              });
            }
          }
          setScannerOpen(false);
          setScanningProductId(null);
        }}
        scanType="product"
        title="Scan Product Barcode"
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
              onUpdate={() => {
                setReorderSettingsOpen(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManagement;
