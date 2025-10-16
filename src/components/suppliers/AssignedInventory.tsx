import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["supplier-inventory", supplierId],
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from("supplier_products")
        .select(`
          *,
          product:products(*, inventory(available_quantity, reorder_level, last_restocked_at, outlet:outlets(name))),
          packaging_item:packaging_items(*)
        `)
        .eq("supplier_id", supplierId);

      if (error) throw error;
      return assignments;
    },
  });

  const getStockStatus = (item: any) => {
    if (item.product) {
      const inv = item.product.inventory?.[0];
      if (!inv) return { label: "No Data", variant: "secondary" as const };
      if (inv.available_quantity === 0) return { label: "Out of Stock", variant: "destructive" as const };
      if (inv.available_quantity <= item.product.reorder_level) return { label: "Low Stock", variant: "secondary" as const };
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

  return (
    <Card className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead>Reorder Level</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Restocked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : filteredInventory?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No assigned items found
              </TableCell>
            </TableRow>
          ) : (
            filteredInventory?.map((item: any) => {
              const status = getStockStatus(item);
              const isProduct = !!item.product;
              const data = isProduct ? item.product : item.packaging_item;
              const inv = isProduct ? item.product?.inventory?.[0] : null;
              const currentStock = isProduct ? (inv?.available_quantity || 0) : (data?.current_stock || 0);
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
                  <TableCell>{currentStock}</TableCell>
                  <TableCell>{reorderLevel}</TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {inv?.last_restocked_at 
                      ? new Date(inv.last_restocked_at).toLocaleDateString()
                      : "-"}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
