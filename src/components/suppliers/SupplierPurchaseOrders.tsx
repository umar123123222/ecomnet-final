import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye } from "lucide-react";
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

interface SupplierPurchaseOrdersProps {
  supplierId: string;
}

export function SupplierPurchaseOrders({ supplierId }: SupplierPurchaseOrdersProps) {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ["supplier-purchase-orders", supplierId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(`
          *,
          outlet:outlets(name)
        `)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: "secondary",
      pending: "default",
      approved: "default",
      delivered: "default",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status.replace("_", " ").toUpperCase()}</Badge>;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Purchase Orders</h2>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO Number</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead>Outlet</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Expected Delivery</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : purchaseOrders?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No purchase orders found
              </TableCell>
            </TableRow>
          ) : (
            purchaseOrders?.map((po: any) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.po_number}</TableCell>
                <TableCell>
                  {new Date(po.order_date).toLocaleDateString()}
                </TableCell>
                <TableCell>{po.outlet?.name || "-"}</TableCell>
                <TableCell>PKR {po.total_amount.toFixed(2)}</TableCell>
                <TableCell>
                  {po.expected_delivery_date 
                    ? new Date(po.expected_delivery_date).toLocaleDateString()
                    : "-"}
                </TableCell>
                <TableCell>{getStatusBadge(po.status)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="ghost">
                    <Eye className="mr-1 h-3 w-3" />
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
