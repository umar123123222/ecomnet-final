import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CustomerInsightsWidget } from "./CustomerInsightsWidget";
import { OrderActivityLog } from "./OrderActivityLog";
import { Package, User, TrendingUp, History } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_email?: string;
  city: string;
  total_amount: number;
  status: string;
  courier?: string | null;
  items: any;
  created_at: string;
  customer_id?: string | null;
}

interface OrderDetailsModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrderDetailsModal = ({ order, open, onOpenChange }: OrderDetailsModalProps) => {
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  
  if (!order) return null;

  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order Details - #{order.order_number}</span>
            <Badge variant={
              order.status === 'delivered' ? 'success' :
              order.status === 'pending' ? 'warning' :
              order.status === 'booked' ? 'default' :
              order.status === 'dispatched' ? 'secondary' :
              order.status === 'returned' ? 'destructive' : 'outline'
            }>
              {order.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details" className="gap-2">
              <Package className="h-4 w-4" />
              Order Details
            </TabsTrigger>
            <TabsTrigger value="customer" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Customer Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Customer Information */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <User className="h-4 w-4" />
                Customer Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Name:</span>
                  <p className="font-medium">{order.customer_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <p className="font-medium">{order.customer_phone}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Address:</span>
                  <p className="font-medium">{order.customer_address}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">City:</span>
                  <p className="font-medium">{order.city}</p>
                </div>
                {order.customer_email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{order.customer_email}</p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Order Items */}
            <div>
              <h3 className="font-semibold flex items-center gap-2 mb-3">
                <Package className="h-4 w-4" />
                Order Items
              </h3>
              <div className="space-y-2">
                {Array.isArray(items) && items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.name || item.product_name}</p>
                      <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">
                      {(Number(item.price || item.unit_price || 0) * Number(item.quantity)).toLocaleString('en-PK', { 
                        style: 'currency', 
                        currency: 'PKR',
                        maximumFractionDigits: 0 
                      })}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t flex justify-between items-center">
                <span className="font-semibold">Total Amount:</span>
                <span className="text-2xl font-bold">
                  {Number(order.total_amount).toLocaleString('en-PK', { 
                    style: 'currency', 
                    currency: 'PKR',
                    maximumFractionDigits: 0 
                  })}
                </span>
              </div>
            </div>

            <Separator />

            {/* Shipping Info */}
            <div>
              <h3 className="font-semibold mb-3">Shipping Information</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Courier:</span>
                  <p className="font-medium">{order.courier || 'Not Assigned'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Order Date:</span>
                  <p className="font-medium">
                    {new Date(order.created_at).toLocaleDateString('en-PK', { 
                      year: 'numeric', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Activity Log Button */}
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setActivityLogOpen(true)}
            >
              <History className="h-4 w-4" />
              View Activity Log
            </Button>
          </TabsContent>

          <TabsContent value="customer" className="mt-4">
            <CustomerInsightsWidget 
              customerId={order.customer_id || null}
              customerName={order.customer_name}
            />
          </TabsContent>
        </Tabs>

        {/* Activity Log Dialog */}
        <OrderActivityLog 
          orderId={order.id} 
          open={activityLogOpen}
          onOpenChange={setActivityLogOpen}
        />
      </DialogContent>
    </Dialog>
  );
};
