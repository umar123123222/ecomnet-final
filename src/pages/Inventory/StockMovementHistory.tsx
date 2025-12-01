import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, TrendingUp, TrendingDown, ArrowLeftRight, Package, Calendar } from "lucide-react";
import { format } from "date-fns";
import { DatePickerWithRange } from "@/components/DatePickerWithRange";
import { DateRange } from "react-day-picker";
import { toast } from "sonner";
import { useUserRoles } from "@/hooks/useUserRoles";

export default function StockMovementHistory() {
  const { permissions } = useUserRoles();
  const [searchTerm, setSearchTerm] = useState("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { data: movements, isLoading } = useQuery({
    queryKey: ["stock-movements", movementTypeFilter, dateRange],
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select(`
          id,
          quantity,
          movement_type,
          notes,
          created_at,
          product:products(name, sku),
          from_outlet:outlets!stock_movements_from_outlet_id_fkey(name),
          to_outlet:outlets!stock_movements_to_outlet_id_fkey(name),
          outlet:outlets!stock_movements_outlet_id_fkey(name),
          performed_by_profile:profiles!stock_movements_performed_by_fkey(full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (movementTypeFilter !== "all") {
        query = query.eq("movement_type", movementTypeFilter);
      }

      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
      }

      if (dateRange?.to) {
        query = query.lte("created_at", dateRange.to.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: permissions.canViewStockMovements,
  });

  const filteredMovements = movements?.filter((movement: any) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      movement.product?.name?.toLowerCase().includes(searchLower) ||
      movement.product?.sku?.toLowerCase().includes(searchLower) ||
      movement.notes?.toLowerCase().includes(searchLower) ||
      movement.outlet?.name?.toLowerCase().includes(searchLower) ||
      movement.from_outlet?.name?.toLowerCase().includes(searchLower) ||
      movement.to_outlet?.name?.toLowerCase().includes(searchLower)
    );
  });

  const handleExportToCSV = () => {
    if (!filteredMovements || filteredMovements.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvContent = [
      ["Date", "Product", "SKU", "Type", "Quantity", "From", "To", "Notes", "Performed By"].join(","),
      ...filteredMovements.map((m: any) =>
        [
          format(new Date(m.created_at), "yyyy-MM-dd hh:mm:ss a"),
          `"${m.product?.name || ""}"`,
          m.product?.sku || "",
          m.movement_type,
          m.quantity,
          m.from_outlet?.name || m.outlet?.name || "",
          m.to_outlet?.name || "",
          `"${m.notes || ""}"`,
          m.performed_by_profile?.full_name || m.performed_by_profile?.email || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-movements-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success("Stock movements exported successfully");
  };

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "adjustment":
        return TrendingUp;
      case "sale":
        return TrendingDown;
      case "transfer":
        return ArrowLeftRight;
      default:
        return Package;
    }
  };

  const getMovementBadgeVariant = (type: string): "default" | "secondary" | "outline" => {
    switch (type) {
      case "adjustment":
        return "default";
      case "sale":
        return "secondary";
      case "transfer":
        return "outline";
      default:
        return "default";
    }
  };

  if (!permissions.canViewStockMovements) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">You don't have permission to view stock movement history.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Stock Movement History</h1>
          <p className="text-muted-foreground">
            Complete audit trail of all stock movements and adjustments
          </p>
        </div>
        <Button onClick={handleExportToCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product, SKU, or notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select value={movementTypeFilter} onValueChange={setMovementTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Movement Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="adjustment">Adjustments</SelectItem>
                <SelectItem value="sale">Sales</SelectItem>
                <SelectItem value="transfer">Transfers</SelectItem>
                <SelectItem value="return">Returns</SelectItem>
              </SelectContent>
            </Select>

            <DatePickerWithRange
              date={dateRange}
              setDate={setDateRange}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Performed By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading movements...
                  </TableCell>
                </TableRow>
              ) : filteredMovements && filteredMovements.length > 0 ? (
                filteredMovements.map((movement: any) => {
                  const Icon = getMovementIcon(movement.movement_type);
                  return (
                    <TableRow key={movement.id}>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(new Date(movement.created_at), "MMM dd, yyyy hh:mm a")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{movement.product?.name}</p>
                          <p className="text-xs text-muted-foreground">{movement.product?.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getMovementBadgeVariant(movement.movement_type)} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {movement.movement_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={movement.quantity > 0 ? "text-success font-medium" : "text-muted-foreground"}>
                          {movement.quantity > 0 ? "+" : ""}{movement.quantity}
                        </span>
                      </TableCell>
                      <TableCell>{movement.from_outlet?.name || movement.outlet?.name || "-"}</TableCell>
                      <TableCell>{movement.to_outlet?.name || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">{movement.notes || "-"}</TableCell>
                      <TableCell>{movement.performed_by_profile?.full_name || movement.performed_by_profile?.email || "-"}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">No stock movements found</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
