import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Package, Truck, MapPin, Clock, CheckCircle, XCircle, AlertCircle, History, FileText, RefreshCw, RotateCcw, Box, ChevronRight, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ConfirmOrderDialog } from "./ConfirmOrderDialog";
import { BookCourierDialog } from "./BookCourierDialog";
import { OrderActivityLog } from "./OrderActivityLog";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

// Compact Vertical Tracking Timeline Component
const TrackingTimeline = ({ 
  trackingHistory, 
  formatTrackingStatus, 
  getStatusIcon, 
  getStatusColor 
}: { 
  trackingHistory: TrackingEvent[];
  formatTrackingStatus: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusColor: (status: string) => string;
}) => {
  const [showAll, setShowAll] = useState(false);
  const INITIAL_DISPLAY = 4;
  const displayedEvents = showAll ? trackingHistory : trackingHistory.slice(0, INITIAL_DISPLAY);
  const hiddenCount = trackingHistory.length - INITIAL_DISPLAY;

  return (
    <Collapsible defaultOpen={true} className="space-y-2">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-2 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
          <span className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Tracking History ({trackingHistory.length})
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="border rounded-lg p-3 bg-card">
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
            
            <div className="space-y-2">
              {displayedEvents.map((event, index) => (
                <div key={event.id} className="relative flex items-start gap-3 pl-7">
                  {/* Timeline dot */}
                  <div className={`absolute left-0 p-1 rounded-full border bg-background ${getStatusColor(event.status)}`}>
                    <div className="h-3 w-3 flex items-center justify-center">
                      {getStatusIcon(event.status)}
                    </div>
                  </div>
                  
                  {/* Event content - single line */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-medium">{formatTrackingStatus(event.status)}</span>
                      {event.current_location && (
                        <span className="text-muted-foreground truncate">{event.current_location}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                        {format(
                          new Date(
                            event.raw_response?.Activity_datetime || 
                            event.raw_response?.activity_datetime || 
                            event.checked_at
                          ), 
                          'MMM d, hh:mm a'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Show more button */}
            {hiddenCount > 0 && !showAll && (
              <button 
                onClick={() => setShowAll(true)}
                className="mt-2 ml-7 text-xs text-primary hover:underline"
              >
                Show {hiddenCount} more update{hiddenCount > 1 ? 's' : ''}...
              </button>
            )}
            {showAll && hiddenCount > 0 && (
              <button 
                onClick={() => setShowAll(false)}
                className="mt-2 ml-7 text-xs text-muted-foreground hover:underline"
              >
                Show less
              </button>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

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
  booked_at: string | null;
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
        // Get booked_at from order - need to fetch it
        const { data: orderData } = await supabase
          .from('orders')
          .select('booked_at')
          .eq('id', order.id)
          .single();
        
        const combinedInfo = {
          tracking_id: dispatch?.tracking_id || order.tracking_id || null,
          courier: dispatch?.courier || order.courier || '',
          dispatch_date: dispatch?.dispatch_date || null, // Don't use created_at as fallback
          booked_at: orderData?.booked_at || null,
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
    if (status === 'delivered') return <CheckCircle className="h-3 w-3 text-green-500" />;
    if (status === 'returned' || status === 'cancelled') return <XCircle className="h-3 w-3 text-red-500" />;
    if (status === 'failed_delivery') return <AlertCircle className="h-3 w-3 text-orange-500" />;
    return <Truck className="h-3 w-3 text-blue-500" />;
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
                {/* Show Dispatched date if available, otherwise show Booked date */}
                {dispatchInfo.dispatch_date ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Dispatched</div>
                      <div className="font-medium">{format(new Date(dispatchInfo.dispatch_date), 'MMM d, yyyy hh:mm a')}</div>
                    </div>
                  </div>
                ) : dispatchInfo.booked_at ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Booked</div>
                      <div className="font-medium">{format(new Date(dispatchInfo.booked_at), 'MMM d, yyyy hh:mm a')}</div>
                    </div>
                  </div>
                ) : null}
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

            {/* Tracking History - Compact Vertical Timeline */}
            {trackingHistory.length > 0 ? (
              <TrackingTimeline 
                trackingHistory={trackingHistory}
                formatTrackingStatus={formatTrackingStatus}
                getStatusIcon={getStatusIcon}
                getStatusColor={getStatusColor}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 space-y-3 border rounded-lg bg-muted/20">
                <div className="p-3 rounded-full bg-muted">
                  <Package className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="space-y-1 text-center">
                  <div className="text-sm font-semibold">No Tracking Data</div>
                  <div className="text-xs text-muted-foreground max-w-xs">
                    Click "Fetch Tracking" to get updates from the courier.
                  </div>
                </div>
                {dispatchInfo?.tracking_id && (
                  <Button variant="outline" size="sm" onClick={handleFetchTracking}>
                    <Package className="h-4 w-4 mr-2" />
                    Fetch Tracking
                  </Button>
                )}
              </div>
            )}
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