import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, Truck, MapPin, Clock, CheckCircle, XCircle, AlertCircle, History, FileText, RefreshCw, RotateCcw, Box } from "lucide-react";
import { ConfirmOrderDialog } from "./ConfirmOrderDialog";
import { BookCourierDialog } from "./BookCourierDialog";
import { OrderActivityLog } from "./OrderActivityLog";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
interface Order {
  id: string;
  order_number: string;
  shopify_order_number?: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_email?: string;
  city: string;
  total_amount: number;
  shipping_charges?: number;
  status: string;
  courier?: string | null;
  tracking_id?: string | null;
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
  estimated_delivery: string | null;
  couriers: {
    name: string;
  } | null;
}
export const OrderDetailsModal = ({
  order,
  open,
  onOpenChange
}: OrderDetailsModalProps) => {
  const [trackingHistory, setTrackingHistory] = useState<TrackingEvent[]>([]);
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBookDialog, setShowBookDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("tracking");
  const [autoFetchAttempted, setAutoFetchAttempted] = useState(false);

  // Fetch packaging recommendation
  const { data: packagingRecommendation, isLoading: packagingLoading } = useQuery({
    queryKey: ['packaging-recommendation', order?.id],
    queryFn: async () => {
      if (!order?.id) return null;
      const { data, error } = await supabase
        .rpc('get_order_packaging_recommendation', { p_order_id: order.id })
        .single();
      if (error) {
        console.error('Error fetching packaging recommendation:', error);
        return null;
      }
      return data;
    },
    enabled: !!order?.id && open
  });
  useEffect(() => {
    if (!open) {
      // Reset state when modal closes
      setLoading(true);
      setDispatchInfo(null);
      setTrackingHistory([]);
      setAutoFetchAttempted(false);
    } else if (order?.id) {
      fetchTrackingDetails();
    } else {
      // Modal open but no valid order ID
      setLoading(false);
    }
  }, [open, order?.id]);

  // Auto-fetch tracking from courier API when Tracking tab becomes active
  useEffect(() => {
    if (activeTab === 'tracking' && dispatchInfo?.tracking_id && order?.courier && open) {
      // Auto-fetch from courier if we don't have recent data (older than 5 minutes)
      const shouldFetch = !trackingHistory.length || trackingHistory[0] && new Date().getTime() - new Date(trackingHistory[0].checked_at).getTime() > 5 * 60 * 1000;
      if (shouldFetch && !autoFetchAttempted) {
        setAutoFetchAttempted(true);
        fetchTrackingFromCourier();
      }
    }
  }, [activeTab, dispatchInfo?.tracking_id, order?.courier, trackingHistory, autoFetchAttempted, open]);
  const fetchTrackingDetails = async () => {
    if (!order?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      console.log('Fetching tracking for order:', order.id, 'courier:', order.courier, 'tracking_id:', order.tracking_id);

      // Check if order has direct booking info (courier + tracking_id in orders table)
      const hasDirectBooking = order.courier && order.tracking_id;
      console.log('Has direct booking:', hasDirectBooking);

      // Fetch dispatch info from dispatches table
      const {
        data: dispatch,
        error: dispatchError
      } = await supabase.from('dispatches').select('*, couriers(name)').eq('order_id', order.id).maybeSingle();
      if (dispatchError) {
        console.error('Error fetching dispatch:', dispatchError);
      }
      console.log('Dispatch data:', dispatch);

      // Combine data from both sources
      if (hasDirectBooking || dispatch) {
        const combinedInfo = {
          tracking_id: dispatch?.tracking_id || order.tracking_id || null,
          courier: dispatch?.courier || order.courier || '',
          dispatch_date: dispatch?.dispatch_date || order.created_at,
          estimated_delivery: dispatch?.estimated_delivery || null,
          couriers: dispatch?.couriers || null
        };
        console.log('Setting dispatch info:', combinedInfo);
        setDispatchInfo(combinedInfo);

        // Fetch tracking history using tracking_id from either source
        const trackingId = dispatch?.tracking_id || order.tracking_id;
        if (trackingId) {
          const {
            data: tracking,
            error: trackingError
          } = await supabase.from('courier_tracking_history').select('*').eq('tracking_id', trackingId).order('checked_at', {
            ascending: false
          });
          if (trackingError) {
            console.error('Error fetching tracking history:', trackingError);
          }
          console.log('Tracking history:', tracking);
          setTrackingHistory(tracking || []);
        } else {
          console.log('No tracking ID available');
          setTrackingHistory([]);
        }
      } else {
        console.log('No booking info found - order not booked');
        setDispatchInfo(null);
        setTrackingHistory([]);
      }
    } catch (error) {
      console.error('Error fetching tracking details:', error);
      setDispatchInfo(null);
      setTrackingHistory([]);
    } finally {
      console.log('Fetch complete, setting loading to false');
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
      failed_delivery: 'Delivery Failed'
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
  const fetchTrackingFromCourier = async (showErrors = false) => {
    if (!dispatchInfo?.tracking_id || !order?.courier) return;
    try {
      console.log('Fetching tracking from courier API for:', dispatchInfo.tracking_id);
      const {
        data,
        error
      } = await supabase.functions.invoke('courier-tracking', {
        body: {
          trackingId: dispatchInfo.tracking_id,
          courierCode: order.courier.toLowerCase()
        }
      });
      if (error || !data?.success) {
        console.error('Tracking fetch failed:', error || data?.error);
        if (showErrors) {
          toast({
            variant: "destructive",
            title: "Tracking Error",
            description: data?.error || error?.message || 'Service unavailable'
          });
        }
        return;
      }
      console.log('Tracking fetched successfully:', data);
      await fetchTrackingDetails();
    } catch (error) {
      console.error('Failed to fetch tracking (network/connection error):', error);
      if (showErrors) {
        toast({
          variant: "destructive",
          title: "Connection Error",
          description: 'Could not connect to tracking service'
        });
      }
    }
  };
  const handleFetchTracking = async () => {
    if (!dispatchInfo?.tracking_id || !order.courier) return;
    try {
      setLoading(true);
      await fetchTrackingFromCourier(true); // Show errors for manual fetch
    } finally {
      setLoading(false);
    }
  };
  return <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-3">
                <span>Order #{order?.order_number || order?.shopify_order_number || order?.id?.slice(0, 8) || 'N/A'}</span>
                <Badge variant={order.status === 'delivered' ? 'success' : order.status === 'confirmed' ? 'default' : order.status === 'booked' ? 'secondary' : order.status === 'pending' ? 'warning' : order.status === 'dispatched' ? 'secondary' : order.status === 'returned' ? 'destructive' : 'outline'}>
                  {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Unknown'}
                </Badge>
              </DialogTitle>
              
              {/* Quick Actions */}
              
            </div>
          </DialogHeader>

          {/* Order Summary Card */}
          <div className="border rounded-lg p-4 bg-card space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer Info */}
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Customer</div>
                <div className="font-medium">{order.customer_name}</div>
                {order.customer_phone && (
                  <div className="text-sm text-muted-foreground">{order.customer_phone}</div>
                )}
                {order.customer_email && (
                  <div className="text-sm text-muted-foreground">{order.customer_email}</div>
                )}
              </div>

              {/* Order Total Breakdown */}
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Order Total</div>
                {order.shipping_charges !== undefined && order.shipping_charges > 0 ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="font-mono">
                        PKR {(order.total_amount - order.shipping_charges).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping:</span>
                      <span className="font-mono">
                        PKR {order.shipping_charges.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="border-t pt-1 mt-1"></div>
                    <div className="flex justify-between font-semibold">
                      <span>Total:</span>
                      <span className="font-mono">
                        PKR {order.total_amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="font-semibold font-mono">
                    PKR {order.total_amount.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="pt-2 border-t">
              <div className="text-sm text-muted-foreground mb-1">Delivery Address</div>
              <div className="text-sm">{order.customer_address}, {order.city}</div>
            </div>

            {/* Packaging Recommendation */}
            {packagingRecommendation && (
              <div className="pt-2 border-t">
                <div className="text-sm text-muted-foreground mb-2">📦 Packaging</div>
                <Alert className={packagingRecommendation.is_available ? 'border-green-500/50 bg-green-500/5' : 'border-orange-500/50 bg-orange-500/5'}>
                  <Box className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{packagingRecommendation.packaging_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({packagingRecommendation.packaging_sku})
                        </span>
                      </div>
                      <div className="text-sm">
                        {packagingRecommendation.is_available ? (
                          <span className="text-green-600 dark:text-green-400">
                            ✓ {packagingRecommendation.current_stock} in stock
                          </span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">
                            ⚠️ Out of stock
                          </span>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>

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

        {loading ? <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading tracking details...</div>
          </div> : !dispatchInfo ? <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Package className="h-16 w-16 text-muted-foreground/30" />
            <div className="text-center space-y-2">
              <h3 className="font-semibold text-lg">Not Booked Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                This order hasn't been booked with a courier yet. Book a courier to start tracking.
              </p>
            </div>
            {order.status === 'confirmed' && <Button onClick={() => setShowBookDialog(true)} className="mt-4">
                <Truck className="mr-2 h-4 w-4" />
                Book Courier Now
              </Button>}
          </div> : <div className="space-y-6 mt-4">
            {/* Dispatch Information */}
            <div className="border rounded-lg p-4 bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg">
                      {dispatchInfo.couriers?.name || dispatchInfo.courier?.toUpperCase() || 'Unknown'}
                    </span>
                  </div>
                  {dispatchInfo.tracking_id && <div className="text-sm text-muted-foreground">
                      Tracking ID: <span className="font-mono font-medium text-foreground">{dispatchInfo.tracking_id}</span>
                    </div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleFetchTracking} disabled={!dispatchInfo.tracking_id}>
                    <Package className="h-4 w-4 mr-2" />
                    Fetch Tracking
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleRefresh}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                {dispatchInfo.dispatch_date && <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Dispatched</div>
                      <div className="font-medium">{format(new Date(dispatchInfo.dispatch_date), 'MMM d, yyyy hh:mm a')}</div>
                    </div>
                  </div>}
                {dispatchInfo.estimated_delivery && <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Est. Delivery</div>
                      <div className="font-medium">{format(new Date(dispatchInfo.estimated_delivery), 'MMM d, yyyy')}</div>
                    </div>
                  </div>}
              </div>
            </div>

            {/* Action Buttons based on latest tracking status */}
            {trackingHistory.length > 0 && <div className="flex flex-wrap gap-2">
                {trackingHistory[0].status === 'delivered' && order.status !== 'delivered' && <Button variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Delivery
                  </Button>}
                
                {trackingHistory[0].status === 'returned' && order.status !== 'returned' && <Button variant="destructive" size="sm">
                    <Package className="mr-2 h-4 w-4" />
                    Process Return
                  </Button>}
                
                {trackingHistory[0].status === 'failed_delivery' && <Button variant="outline" size="sm">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reattempt Delivery
                  </Button>}
                
                {dispatchInfo?.tracking_id && <Button variant="outline" size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    Shipper Advice
                  </Button>}
              </div>}

            {/* Tracking History - Horizontal Table Format */}
            {trackingHistory.length > 0 ? <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Tracking History
                </h3>
                
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="w-full">
                    <div className="min-w-max p-6">
                      {/* Horizontal tracking stages */}
                      <div className="flex items-start gap-1">
                        {trackingHistory.map((event, index) => <div key={event.id} className="flex items-start flex-1 min-w-[160px]">
                            {/* Stage card */}
                            <div className="flex flex-col items-center text-center flex-1">
                              {/* Icon with checkmark badge */}
                              <div className="relative mb-3">
                                <div className={`p-3 rounded-full ${getStatusColor(event.status).includes('green') || getStatusColor(event.status).includes('blue') ? 'bg-primary/10' : 'bg-muted'}`}>
                                  <div className={`h-8 w-8 flex items-center justify-center ${getStatusColor(event.status).includes('green') || getStatusColor(event.status).includes('blue') ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {getStatusIcon(event.status)}
                                  </div>
                                </div>
                                {/* Checkmark badge for completed stages */}
                                {(getStatusColor(event.status).includes('green') || getStatusColor(event.status).includes('blue')) && <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-0.5">
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  </div>}
                              </div>
                              
                              {/* Stage info */}
                              <div className="space-y-1">
                                <div className="text-sm font-medium">
                                  {formatTrackingStatus(event.status)}
                                </div>
                                {event.current_location && <div className="text-xs text-muted-foreground">
                                    {event.current_location}
                                  </div>}
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(event.checked_at), 'MMM d, yyyy')}
                                </div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {format(new Date(event.checked_at), 'hh:mm a')}
                                </div>
                              </div>
                            </div>
                            
                            {/* Connector line - show except for last item */}
                            {index < trackingHistory.length - 1 && <div className="flex items-center pt-6 px-2">
                                <div className={`h-px flex-1 min-w-[20px] ${getStatusColor(event.status).includes('green') || getStatusColor(event.status).includes('blue') ? 'bg-primary' : 'bg-border'}`} />
                              </div>}
                          </div>)}
                      </div>
                    </div>
                  </ScrollArea>
                </div>

                {/* Detailed tracking table */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 border-b">
                    <h4 className="text-sm font-semibold">Detailed History</h4>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <table className="w-full">
                      <thead className="bg-muted/30 sticky top-0">
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Location</th>
                          <th className="text-left p-3 font-medium">Date & Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trackingHistory.map(event => <tr key={event.id} className="border-b hover:bg-muted/20 transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-full ${getStatusColor(event.status)}`}>
                                  {getStatusIcon(event.status)}
                                </div>
                                <span className="text-sm font-medium">
                                  {formatTrackingStatus(event.status)}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              {event.current_location ? <div className="flex items-center gap-1.5 text-sm">
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  {event.current_location}
                                </div> : <span className="text-sm text-muted-foreground">-</span>}
                            </td>
                            <td className="p-3">
                              <div className="text-sm">
                                {format(new Date(event.checked_at), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                {format(new Date(event.checked_at), 'hh:mm:ss a')}
                              </div>
                            </td>
                          </tr>)}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div> : <div className="flex flex-col items-center justify-center py-12 space-y-4 border rounded-lg bg-muted/20">
                <div className="p-4 rounded-full bg-muted">
                  <Package className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="space-y-1 text-center">
                  <div className="text-lg font-semibold">No Tracking Data Available</div>
                  <div className="text-sm text-muted-foreground max-w-md">
                    Tracking updates from the courier haven't been fetched yet. Click "Fetch Tracking" to get the latest updates.
                  </div>
                </div>
                {dispatchInfo?.tracking_id && <Button variant="default" onClick={handleFetchTracking}>
                    <Package className="h-4 w-4 mr-2" />
                    Fetch Tracking Now
                  </Button>}
              </div>}
          </div>}
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <OrderActivityLog orderId={order.id} open={activeTab === 'activity'} onOpenChange={() => {}} embedded={true} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Confirmation Dialogs */}
    <ConfirmOrderDialog orderId={order.id} orderNumber={order.order_number} open={showConfirmDialog} onOpenChange={setShowConfirmDialog} onSuccess={handleRefresh} />

    <BookCourierDialog orderId={order.id} orderNumber={order.order_number} open={showBookDialog} onOpenChange={setShowBookDialog} onSuccess={handleRefresh} />
    </>;
};