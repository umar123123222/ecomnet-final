import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Search, Plus, Loader2, Edit, AlertCircle, CheckCircle, XCircle, Download, ScanBarcode, Printer, QrCode } from "lucide-react";
import { BarcodeScanner } from '@/components/barcode/BarcodeScanner';
import { Product } from "@/types/inventory";
import { AddProductDialog } from "@/components/inventory/AddProductDialog";
import { ProductBarcodeManager } from "@/components/barcode/ProductBarcodeManager";
import { useAdvancedFilters } from "@/hooks/useAdvancedFilters";
import { AdvancedFilterPanel } from "@/components/AdvancedFilterPanel";
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanel } from '@/components/BulkOperationsPanel';
import { bulkToggleProducts, bulkUpdateProductCategory, exportToCSV } from '@/utils/bulkOperations';
import { useToast } from '@/hooks/use-toast';

const ProductManagement = () => {
  const { toast } = useToast();
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanningProductId, setScanningProductId] = useState<string | null>(null);
  const [barcodeManagerOpen, setBarcodeManagerOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const { progress, executeBulkOperation } = useBulkOperations();


  // Fetch products
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
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
    {
      id: 'activate',
      label: 'Activate',
      icon: CheckCircle,
      action: async (ids) => bulkToggleProducts(ids, true),
    },
    {
      id: 'deactivate',
      label: 'Deactivate',
      icon: XCircle,
      variant: 'destructive',
      action: async (ids) => bulkToggleProducts(ids, false),
      requiresConfirmation: true,
      confirmMessage: 'Are you sure you want to deactivate the selected products? They will no longer be available for orders.',
    },
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
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setBarcodeProduct(product);
                                setBarcodeManagerOpen(true);
                              }}
                            >
                              <QrCode className="h-3 w-3" />
                              Barcodes
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
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No products found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
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

      <Dialog open={barcodeManagerOpen} onOpenChange={setBarcodeManagerOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>3-Level Barcode Management</DialogTitle>
          </DialogHeader>
          {barcodeProduct && (
            <ProductBarcodeManager
              productId={barcodeProduct.id}
              productName={barcodeProduct.name}
              productSku={barcodeProduct.sku}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductManagement;
