import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LowStockNotificationsProps {
  supplierId: string;
}

export function LowStockNotifications({ supplierId }: LowStockNotificationsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["supplier-notifications", supplierId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("low_stock_notifications")
        .select(`
          *,
          product:products(name, sku),
          packaging_item:packaging_items(name, sku)
        `)
        .eq("supplier_id", supplierId)
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("low_stock_notifications")
        .update({ response_received: true, response_at: new Date().toISOString() })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-notifications"] });
      toast({ title: "Notification acknowledged" });
    },
    onError: (error: any) => {
      toast({
        title: "Error acknowledging notification",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <AlertTriangle className="h-5 w-5 text-warning" />
        <h2 className="text-xl font-semibold">Low Stock Alerts</h2>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Current Stock</TableHead>
            <TableHead>Reorder Level</TableHead>
            <TableHead>Suggested Qty</TableHead>
            <TableHead>Sent Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center">
                Loading...
              </TableCell>
            </TableRow>
          ) : notifications?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center">
                No notifications found
              </TableCell>
            </TableRow>
          ) : (
            notifications?.map((notification: any) => {
              const item = notification.product || notification.packaging_item;
              return (
                <TableRow key={notification.id}>
                  <TableCell className="font-medium">{item?.name}</TableCell>
                  <TableCell>{item?.sku}</TableCell>
                  <TableCell>
                    <Badge variant="destructive">{notification.current_stock}</Badge>
                  </TableCell>
                  <TableCell>{notification.reorder_level}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{notification.suggested_quantity}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(notification.sent_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {notification.response_received ? (
                      <Badge variant="default">Acknowledged</Badge>
                    ) : notification.po_created ? (
                      <Badge variant="default">PO Created</Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!notification.response_received && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(notification.id)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Acknowledge
                      </Button>
                    )}
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
