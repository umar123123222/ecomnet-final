import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, AlertTriangle } from "lucide-react";
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
          outlet:outlets(name),
          purchase_order_items(
            id,
            quantity_ordered,
            quantity_received,
            product_id,
            products(name)
          )
        `)
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Calculate variance for each PO
      return data.map((po: any) => {
        const items = po.purchase_order_items || [];
        const totalOrdered = items.reduce((sum: number, item: any) => sum + (item.quantity_ordered || 0), 0);
        const totalReceived = items.reduce((sum: number, item: any) => sum + (item.quantity_received || 0), 0);
        const variance = totalOrdered - totalReceived;
        const hasVariance = variance !== 0 && totalReceived > 0;
        
        return {
          ...po,
          totalOrdered,
          totalReceived,
          variance,
          hasVariance
        };
      });
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

  const varianceCount = purchaseOrders?.filter((po: any) => po.hasVariance).length || 0;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Purchase Orders</h2>
          {varianceCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {varianceCount} with variance
            </Badge>
          )}
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
            <TableHead>Ordered/Received</TableHead>
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
              <TableCell colSpan={8} className="text-center">
                No purchase orders found
              </TableCell>
            </TableRow>
          ) : (
            purchaseOrders?.map((po: any) => (
              <TableRow key={po.id} className={po.hasVariance ? "bg-yellow-50 dark:bg-yellow-950/10" : ""}>
                <TableCell className="font-medium">{po.po_number}</TableCell>
                <TableCell>
                  {new Date(po.order_date).toLocaleDateString()}
                </TableCell>
                <TableCell>{po.outlet?.name || "-"}</TableCell>
                <TableCell>PKR {po.total_amount.toFixed(2)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{po.totalOrdered}</span>
                    <span className="text-muted-foreground">/</span>
                    <span className={po.totalReceived > 0 ? "font-medium" : "text-muted-foreground"}>
                      {po.totalReceived}
                    </span>
                    {po.hasVariance && (
                      <Badge variant="destructive" className="ml-2">
                        Variance: {Math.abs(po.variance)}
                      </Badge>
                    )}
                  </div>
                </TableCell>
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
