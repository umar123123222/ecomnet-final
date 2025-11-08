import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerInsightsWidget } from "./CustomerInsightsWidget";
import { OrderActivityLog } from "./OrderActivityLog";
import { Package, User, TrendingUp, History, Mail, Phone, MapPin, Calendar, Truck, ShoppingBag } from "lucide-react";

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

  // Merge duplicate items
  const mergedItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    
    const itemMap = new Map();
    items.forEach((item: any) => {
      const name = item.name || item.product_name;
      const price = Number(item.price || item.unit_price || 0);
      
      if (itemMap.has(name)) {
        const existing = itemMap.get(name);
        existing.quantity += Number(item.quantity);
      } else {
        itemMap.set(name, {
          name,
          price,
          quantity: Number(item.quantity)
        });
      }
    });
    
    return Array.from(itemMap.values());
  }, [items]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
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
            {/* Customer Information Card */}
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                  <User className="h-5 w-5 text-primary" />
                  Customer Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Name</p>
                      <p className="font-medium">{order.customer_name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Phone</p>
                      <p className="font-medium">{order.customer_phone}</p>
                    </div>
                  </div>
                  
                  {order.customer_email ? (
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground mb-0.5">Email</p>
                        <p className="font-medium">{order.customer_email}</p>
                      </div>
                    </div>
                  ) : null}
                  
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Address</p>
                      <p className="font-medium">{order.customer_address}</p>
                      <p className="text-sm text-muted-foreground mt-1">{order.city}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Summary Card */}
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                  Order Summary
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Order Number</p>
                      <p className="font-medium">#{order.order_number}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Order Date</p>
                      <p className="font-medium">
                        {new Date(order.created_at).toLocaleDateString('en-PK', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-0.5">Courier</p>
                      <p className="font-medium">
                        {order.courier || <span className="text-muted-foreground italic">Not Assigned</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items Card */}
            <Card className="border-border/50">
              <CardContent className="p-5">
                <h3 className="font-semibold flex items-center gap-2 mb-4 text-lg">
                  <Package className="h-5 w-5 text-primary" />
                  Items Ordered
                </h3>
                <div className="space-y-2.5">
                  {mergedItems.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between items-center p-3.5 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <p className="font-medium text-base">{item.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.quantity} × {Number(item.price).toLocaleString('en-PK', { 
                            style: 'currency', 
                            currency: 'PKR',
                            maximumFractionDigits: 0 
                          })}
                        </p>
                      </div>
                      <p className="font-semibold text-lg ml-4">
                        {(item.price * item.quantity).toLocaleString('en-PK', { 
                          style: 'currency', 
                          currency: 'PKR',
                          maximumFractionDigits: 0 
                        })}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 pt-4 border-t border-border flex justify-between items-center">
                  <span className="font-semibold text-base">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">
                    {Number(order.total_amount).toLocaleString('en-PK', { 
                      style: 'currency', 
                      currency: 'PKR',
                      maximumFractionDigits: 0 
                    })}
                  </span>
                </div>
              </CardContent>
            </Card>

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
