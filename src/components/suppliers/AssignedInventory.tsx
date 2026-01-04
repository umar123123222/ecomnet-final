import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCurrency } from "@/hooks/useCurrency";
import { AssignedInventoryMobileCard } from "./AssignedInventoryMobileCard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignedInventoryProps {
  supplierId: string;
}

export function AssignedInventory({ supplierId }: AssignedInventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const isMobile = useIsMobile();
  const { formatCurrency } = useCurrency();

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["supplier-inventory", supplierId],
    queryFn: async () => {
      // Fetch supplier product assignments
      const { data: assignments, error } = await supabase
        .from("supplier_products")
        .select(`
          *,
          product:products(*),
          packaging_item:packaging_items(*)
        `)
        .eq("supplier_id", supplierId);

      if (error) throw error;
      if (!assignments || assignments.length === 0) return [];

      // Get product IDs to fetch warehouse inventory
      const productIds = assignments
        .filter((a: any) => a.product_id)
        .map((a: any) => a.product_id);

      // If there are products, fetch their warehouse inventory
      if (productIds.length > 0) {
        // Get warehouse outlet
        const { data: warehouseOutlet } = await supabase
          .from("outlets")
          .select("id")
          .eq("outlet_type", "warehouse")
          .limit(1)
          .single();

        if (warehouseOutlet?.id) {
          const { data: inventoryData } = await supabase
            .from("inventory")
            .select("product_id, quantity, reserved_quantity, available_quantity")
            .eq("outlet_id", warehouseOutlet.id)
            .in("product_id", productIds);

          // Attach inventory to product assignments
          return assignments.map((item: any) => {
            if (item.product_id && inventoryData) {
              const inv = inventoryData.find((i: any) => i.product_id === item.product_id);
              return { ...item, warehouseInventory: inv };
            }
            return item;
          });
        }
      }

      // Return assignments as-is (packaging items use their current_stock)
      return assignments;
    },
  });

  const getStockStatus = (item: any) => {
    if (item.product) {
      const inv = item.warehouseInventory;
      if (!inv) return { label: "No Data", variant: "secondary" as const };
      const availableQty = inv.available_quantity ?? (inv.quantity - inv.reserved_quantity);
      if (availableQty === 0) return { label: "Out of Stock", variant: "destructive" as const };
      if (availableQty <= item.product.reorder_level) return { label: "Low Stock", variant: "secondary" as const };
      return { label: "In Stock", variant: "default" as const };
    } else if (item.packaging_item) {
      const stock = item.packaging_item.current_stock;
      const reorder = item.packaging_item.reorder_level;
      if (stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
      if (stock <= reorder) return { label: "Low Stock", variant: "secondary" as const };
      return { label: "In Stock", variant: "default" as const };
    }
    return { label: "Unknown", variant: "secondary" as const };
  };

  const filteredInventory = inventory?.filter((item: any) => {
    const name = item.product?.name || item.packaging_item?.name || "";
    const sku = item.product?.sku || item.packaging_item?.sku || "";
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === "all") return matchesSearch;
    const status = getStockStatus(item).label;
    return matchesSearch && status.toLowerCase().includes(statusFilter);
  });

  // Calculate summary stats
  const totalItems = inventory?.length || 0;
  const lowStockItems = inventory?.filter((item: any) => getStockStatus(item).label === "Low Stock").length || 0;
  const outOfStockItems = inventory?.filter((item: any) => getStockStatus(item).label === "Out of Stock").length || 0;

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-12" />
                </div>
              </div>
            </Card>
          ))}
        </div>
        <Card className="p-6">
          {isMobile ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className={`grid gap-4 ${isMobile ? 'grid-cols-3' : 'md:grid-cols-3'}`}>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Total</p>
              <p className="text-lg sm:text-2xl font-bold">{totalItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-yellow-500/10 rounded-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Low</p>
              <p className="text-lg sm:text-2xl font-bold text-yellow-600">{lowStockItems}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-destructive/10 rounded-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-muted-foreground">Out</p>
              <p className="text-lg sm:text-2xl font-bold text-destructive">{outOfStockItems}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className={isMobile ? "p-3" : "p-6"}>
        <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center gap-4'} mb-4 sm:mb-6`}>
          <div className="flex items-center gap-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={isMobile ? "w-full" : "max-w-sm"}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className={isMobile ? "w-full" : "w-[180px]"}>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="in stock">In Stock</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        {isMobile ? (
          <div className="space-y-3">
            {filteredInventory?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No assigned items found</p>
              </div>
            ) : (
              filteredInventory?.map((item: any) => (
                <AssignedInventoryMobileCard
                  key={item.id}
                  item={item}
                  getStockStatus={getStockStatus}
                />
              ))
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>MOQ</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInventory?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center">
                      No assigned items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventory?.map((item: any) => {
                    const status = getStockStatus(item);
                    const isProduct = !!item.product;
                    const data = isProduct ? item.product : item.packaging_item;
                    const inv = isProduct ? item.warehouseInventory : null;
                    const currentStock = isProduct 
                      ? (inv?.available_quantity ?? (inv ? inv.quantity - inv.reserved_quantity : 0)) 
                      : (data?.current_stock || 0);
                    const reorderLevel = data?.reorder_level || 0;

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{data?.name}</TableCell>
                        <TableCell>{data?.sku}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {isProduct ? "Product" : data?.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(item.unit_cost || 0)}</TableCell>
                        <TableCell>{item.minimum_order_quantity || 1}</TableCell>
                        <TableCell>{item.lead_time_days || 7} days</TableCell>
                        <TableCell className={currentStock <= reorderLevel ? "text-destructive font-medium" : ""}>
                          {currentStock}
                        </TableCell>
                        <TableCell>{reorderLevel}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}