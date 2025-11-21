import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { 
  Package, 
  Truck, 
  MapPin, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  History,
  FileText
} from "lucide-react";
import { ConfirmOrderDialog } from "./ConfirmOrderDialog";
import { BookCourierDialog } from "./BookCourierDialog";
import { OrderActivityLog } from "./OrderActivityLog";

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

interface TrackingEvent {
  id: string;
  status: string;
  current_location: string | null;
  checked_at: string;
  raw_response: any;
}

interface DispatchInfo {
  tracking_id: string | null;
  courier: string;
  dispatch_date: string | null;
  status: string;
  estimated_delivery: string | null;
  couriers: {
    name: string;
  } | null;
}

export const OrderDetailsModal = ({ order, open, onOpenChange }: OrderDetailsModalProps) => {
  const [trackingHistory, setTrackingHistory] = useState<TrackingEvent[]>([]);
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("tracking");

  useEffect(() => {
    if (open && order?.id) {
      fetchTrackingDetails();
    }
  }, [open, order?.id]);

  const fetchTrackingDetails = async () => {
    if (!order?.id) return;
    
    try {
      setLoading(true);

      // Fetch dispatch info
      const { data: dispatch } = await supabase
        .from('dispatches')
        .select('*, couriers(name)')
        .eq('order_id', order.id)
        .maybeSingle();

      setDispatchInfo(dispatch);

      // Fetch tracking history
      const { data: tracking } = await supabase
        .from('courier_tracking_history')
        .select('*')
        .eq('order_id', order.id)
        .order('checked_at', { ascending: false });

      setTrackingHistory(tracking || []);
    } catch (error) {
      console.error('Error fetching tracking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTrackingStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      booked: 'Shipment Booked',
      picked_up: 'Picked Up',
      in_transit: 'In Transit',
      at_warehouse: 'At Warehouse',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      returned: 'Returned to Sender',
      cancelled: 'Cancelled',
      failed_delivery: 'Delivery Failed',
    };
    return statusMap[status] || status;
  };

  const getStatusIcon = (status: string) => {
    if (status === 'delivered') return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (status === 'returned' || status === 'cancelled') return <XCircle className="h-5 w-5 text-red-500" />;
    if (status === 'failed_delivery') return <AlertCircle className="h-5 w-5 text-orange-500" />;
    return <Truck className="h-5 w-5 text-blue-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'delivered') return 'bg-green-500/10 text-green-500 border-green-500/20';
    if (status === 'returned' || status === 'cancelled') return 'bg-red-500/10 text-red-500 border-red-500/20';
    if (status === 'failed_delivery') return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
  };

  if (!order) return null;

  const handleRefresh = () => {
    fetchTrackingDetails();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span>Order #{order.order_number}</span>
                <Badge variant={
                  order.status === 'delivered' ? 'success' :
                  order.status === 'confirmed' ? 'default' :
                  order.status === 'booked' ? 'secondary' :
                  order.status === 'pending' ? 'warning' :
                  order.status === 'dispatched' ? 'secondary' :
                  order.status === 'returned' ? 'destructive' : 'outline'
                }>
                  {order.status}
                </Badge>
              </DialogTitle>
              
              {/* Quick Actions */}
              <div className="flex items-center gap-2">
                {order.status === 'pending' && (
                  <Button
                    size="sm"
                    onClick={() => setShowConfirmDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Order
                  </Button>
                )}
                {order.status === 'confirmed' && (
                  <Button
                    size="sm"
                    onClick={() => setShowBookDialog(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Book Courier
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tracking">
                <Package className="mr-2 h-4 w-4" />
                Tracking
              </TabsTrigger>
              <TabsTrigger value="activity">
                <History className="mr-2 h-4 w-4" />
                Activity Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tracking" className="mt-4">

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading tracking details...</div>
          </div>
        ) : !dispatchInfo ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-muted-foreground">Order not yet dispatched</div>
            <div className="text-sm text-muted-foreground">Tracking information will appear once the order is shipped</div>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Dispatch Information */}
            <div className="border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg">
                      {dispatchInfo.couriers?.name || dispatchInfo.courier}
                    </span>
                  </div>
                  {dispatchInfo.tracking_id && (
                    <div className="text-sm text-muted-foreground">
                      Tracking ID: <span className="font-mono font-medium text-foreground">{dispatchInfo.tracking_id}</span>
                    </div>
                  )}
                </div>
                <Badge className={getStatusColor(dispatchInfo.status)}>
                  {formatTrackingStatus(dispatchInfo.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {dispatchInfo.dispatch_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Dispatched</div>
                      <div className="font-medium">{format(new Date(dispatchInfo.dispatch_date), 'MMM d, yyyy HH:mm')}</div>
                    </div>
                  </div>
                )}
                {dispatchInfo.estimated_delivery && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Est. Delivery</div>
                      <div className="font-medium">{format(new Date(dispatchInfo.estimated_delivery), 'MMM d, yyyy')}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tracking History Timeline */}
            {trackingHistory.length > 0 ? (
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Tracking History
                </h3>
                
                <ScrollArea className="h-[400px] pr-4">
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
                    
                    <div className="space-y-4">
                      {trackingHistory.map((event) => (
                        <div key={event.id} className="relative pl-14">
                          {/* Timeline dot */}
                          <div className={`absolute left-4 top-1 p-1.5 rounded-full border-2 bg-background ${getStatusColor(event.status)}`}>
                            {getStatusIcon(event.status)}
                          </div>

                          <div className="border rounded-lg p-4 bg-card space-y-2">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <Badge className={getStatusColor(event.status)}>
                                  {formatTrackingStatus(event.status)}
                                </Badge>
                                {event.current_location && (
                                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4" />
                                    {event.current_location}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                                <Clock className="h-3 w-3" />
                                {format(new Date(event.checked_at), 'MMM d, yyyy HH:mm')}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-2 border rounded-lg bg-muted/20">
                <MapPin className="h-10 w-10 text-muted-foreground/50" />
                <div className="text-sm text-muted-foreground">No tracking updates yet</div>
                <div className="text-xs text-muted-foreground">Updates will appear here as the shipment moves</div>
              </div>
            )}
          </div>
        )}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <OrderActivityLog 
              orderId={order.id} 
              open={activeTab === 'activity'} 
              onOpenChange={() => {}} 
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Confirmation Dialogs */}
    <ConfirmOrderDialog
      orderId={order.id}
      orderNumber={order.order_number}
      open={showConfirmDialog}
      onOpenChange={setShowConfirmDialog}
      onSuccess={handleRefresh}
    />

    <BookCourierDialog
      orderId={order.id}
      orderNumber={order.order_number}
      open={showBookDialog}
      onOpenChange={setShowBookDialog}
      onSuccess={handleRefresh}
    />
    </>
  );
};
