import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  Clock, 
  User, 
  Package, 
  CheckCircle, 
  Truck, 
  MapPin, 
  XCircle, 
  AlertCircle,
  FileText,
  Send,
  RotateCcw,
  ChevronDown,
  Info,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface TimelineEvent {
  id: string;
  type: 'order_created' | 'order_confirmed' | 'order_dispatched' | 'tracking_update' | 'status_changed' | 'order_delivered' | 'order_returned' | 'order_cancelled' | 'activity';
  timestamp: string;
  title: string;
  description?: string;
  location?: string;
  user?: {
    full_name: string;
    email: string;
  } | null;
  details?: any;
  status?: string;
  rawResponse?: any;
}

interface OrderActivityLogProps {
  orderId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean; // If true, renders inline without Dialog wrapper
}

export function OrderActivityLog({ orderId, open, onOpenChange, embedded = false }: OrderActivityLogProps) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = useCallback(async () => {
    try {
      setLoading(true);
      console.log('Fetching timeline for order:', orderId);
      
      // 1. Get activity logs - check for both 'order' entity type AND dispatch-related logs
      // First get dispatch IDs for this order
      const { data: dispatches } = await supabase
        .from('dispatches')
        .select('id')
        .eq('order_id', orderId);
      
      const dispatchIds = dispatches?.map(d => d.id) || [];
      
      // Query activity logs for this order
      const { data: orderLogs, error: orderLogsError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('entity_type', 'order')
        .eq('entity_id', orderId)
        .order('created_at', { ascending: false });

      // Query activity logs for dispatches separately if needed
      let dispatchLogs: any[] = [];
      if (dispatchIds.length > 0) {
        const { data } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('entity_type', 'dispatch')
          .in('entity_id', dispatchIds)
          .order('created_at', { ascending: false });
        dispatchLogs = data || [];
      }
      
      const activityLogs = [...(orderLogs || []), ...dispatchLogs];
      const activityError = orderLogsError;

      if (activityError) throw activityError;
      console.log('Activity logs:', activityLogs);

      // 2. Get courier tracking history
      const { data: trackingHistory, error: trackingError } = await supabase
        .from('courier_tracking_history')
        .select('*')
        .eq('order_id', orderId)
        .order('checked_at', { ascending: false });

      if (trackingError) throw trackingError;
      console.log('Tracking history:', trackingHistory);

      // 3. Get order details for timestamps (without confirmed_at and confirmed_by which were dropped)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('created_at, dispatched_at, delivered_at, status, booked_at, booked_by')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;
      console.log('Order details:', order);

      // 4. Get dispatch info
      const { data: dispatch } = await supabase
        .from('dispatches')
        .select('*, couriers(name)')
        .eq('order_id', orderId)
        .maybeSingle();

      // 5. Fetch user profiles for activity logs
      const userIds = [...new Set(activityLogs.map(log => log.user_id).filter(Boolean))];
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      // Helper to infer actual action type from details
      const inferActionType = (action: string, details: any) => {
        if (action === 'order_updated' && details) {
          if (details.tag_added) return 'tag_added';
          if (details.tag_removed) return 'tag_removed';
          if (details.comment) return 'comment_added';
          if (details.note) return 'note_added';
          if (details.field === 'status' || (details.old_status && details.new_status)) return 'status_changed';
        }
        return action;
      };

      // Build unified timeline
      const events: TimelineEvent[] = [];

      // Order created
      if (order?.created_at) {
        events.push({
          id: `created-${orderId}`,
          type: 'order_created',
          timestamp: order.created_at,
          title: 'Order Created',
          description: 'Order was placed in the system',
        });
      }

      // Order confirmed - check from activity logs or status
      const confirmLog = activityLogs?.find(log => log.action === 'order_confirmed');
      if (confirmLog) {
        const confirmUser = userMap.get(confirmLog.user_id);
        events.push({
          id: `confirmed-${orderId}`,
          type: 'order_confirmed',
          timestamp: confirmLog.created_at,
          title: 'Order Confirmed',
          description: confirmUser ? `Confirmed by ${confirmUser.full_name || confirmUser.email}` : 'Order confirmed',
        });
      } else if (order?.status === 'confirmed' || order?.status === 'booked' || order?.status === 'dispatched' || order?.status === 'delivered') {
        // Fallback if no log but status indicates confirmation
        events.push({
          id: `confirmed-${orderId}`,
          type: 'order_confirmed',
          timestamp: order.created_at, // Use created_at as fallback
          title: 'Order Confirmed',
          description: 'Order was confirmed',
        });
      }

      // Order dispatched
      if (order?.dispatched_at) {
        events.push({
          id: `dispatched-${orderId}`,
          type: 'order_dispatched',
          timestamp: order.dispatched_at,
          title: 'Order Dispatched',
          description: dispatch?.couriers?.name 
            ? `Dispatched via ${dispatch.couriers.name}`
            : 'Order has been dispatched',
          details: dispatch?.tracking_id ? { tracking_id: dispatch.tracking_id } : undefined,
        });
      }

      // Order delivered
      if (order?.delivered_at) {
        events.push({
          id: `delivered-${orderId}`,
          type: 'order_delivered',
          timestamp: order.delivered_at,
          title: 'Order Delivered',
          description: 'Order successfully delivered to customer',
        });
      }

      // Add activity logs
      activityLogs.forEach(log => {
        const user = userMap.get(log.user_id);
        const actualAction = inferActionType(log.action, log.details);
        events.push({
          id: log.id,
          type: 'activity',
          timestamp: log.created_at,
          title: getActionLabel(actualAction),
          description: getActionDescription(actualAction, log.details),
          user,
          details: log.details,
        });
      });

      // Only add significant courier tracking events (not every transit update)
      // Granular tracking (in_transit, at_warehouse, etc.) is shown in Tracking History section
      const significantTrackingStatuses = ['delivered', 'returned', 'cancelled', 'failed_delivery'];
      trackingHistory?.filter(tracking => 
        significantTrackingStatuses.includes(tracking.status)
      ).forEach(tracking => {
        events.push({
          id: tracking.id,
          type: 'tracking_update',
          timestamp: tracking.checked_at,
          title: formatTrackingStatus(tracking.status), // Use actual status name instead of "Tracking Update"
          description: tracking.current_location ? `Location: ${tracking.current_location}` : undefined,
          location: tracking.current_location,
          status: tracking.status,
        });
      });

      // Sort by timestamp descending
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      console.log('Final timeline events:', events);
      setTimeline(events);
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      console.log('Timeline fetch complete');
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    // In embedded mode (e.g. inside tabs), we don't get an `open` prop,
    // so trigger the fetch whenever the component mounts or orderId changes.
    if (embedded) {
      if (orderId) {
        fetchTimeline();
      }
    } else {
      if (open && orderId) {
        fetchTimeline();
      }
    }
  }, [embedded, open, orderId, fetchTimeline]);

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      order_created: 'Order Created',
      order_updated: 'Order Updated',
      order_dispatched: 'Dispatched',
      order_delivered: 'Delivered',
      order_returned: 'Returned',
      order_cancelled: 'Cancelled',
      order_assigned: 'Courier Assigned',
      order_confirmed: 'Order Confirmed',
      order_booked: 'Courier Booked',
      status_changed: 'Status Changed',
      verification_updated: 'Verification Updated',
      address_updated: 'Address Updated',
      tracking_update: 'Tracking Update',
      tag_added: 'Tag Added',
      tag_removed: 'Tag Removed',
      comment_added: 'Comment Added',
      note_added: 'Note Added',
    };
    return labels[action] || action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };
 
  const getActionDescription = (action: string, details: any) => {
    if (!details) return undefined;
    
    // Status changed is now handled specially with badges in the render
    if (action === 'status_changed') {
      return null; // Return null so we render badges instead
    }
    
    if (action === 'order_assigned' && details.courier) {
      return `Assigned to courier: ${details.courier}`;
    }
    
    if (action === 'order_booked' && details.courier) {
      return `Booked with ${details.courier}${details.tracking_id ? ` (Tracking: ${details.tracking_id})` : ''}`;
    }
    
    if (action === 'address_updated') {
      return 'Customer address was updated';
    }
    
    if (action === 'verification_updated' && details.verified !== undefined) {
      return details.verified ? 'Address verified' : 'Address verification failed';
    }

    if (action === 'tag_added') {
      return `Tag added: "${details.tag_added || details.tag}"`;
    }

    if (action === 'tag_removed') {
      return `Tag removed: "${details.tag_removed || details.tag}"`;
    }

    if (action === 'comment_added' || action === 'note_added') {
      return details.comment || details.note;
    }
    
    return undefined;
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      confirmed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      booked: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      dispatched: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      delivered: 'bg-green-500/10 text-green-600 border-green-500/20',
      returned: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const renderStatusTransition = (details: any) => {
    const oldStatus = details?.old_status || details?.previous_status || details?.from;
    const newStatus = details?.new_status || details?.to;
    
    if (!oldStatus || !newStatus) return null;
    
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`text-xs capitalize ${getStatusBadgeColor(oldStatus)}`}>
          {oldStatus}
        </Badge>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <Badge variant="outline" className={`text-xs capitalize ${getStatusBadgeColor(newStatus)}`}>
          {newStatus}
        </Badge>
      </div>
    );
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

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'order_created':
        return <FileText className="h-4 w-4" />;
      case 'order_confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'order_dispatched':
        return <Send className="h-4 w-4" />;
      case 'tracking_update':
        return <Truck className="h-4 w-4" />;
      case 'order_delivered':
        return <Package className="h-4 w-4" />;
      case 'order_returned':
        return <RotateCcw className="h-4 w-4" />;
      case 'order_cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'status_changed':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Check if event is a status change event
  const isStatusChangeEvent = (event: TimelineEvent) => {
    const action = event.details?.action || event.type;
    return action === 'status_changed' && (
      (event.details?.old_status && event.details?.new_status) ||
      (event.details?.previous_status && event.details?.new_status) ||
      (event.details?.from && event.details?.to)
    );
  };

  const getEventColor = (type: string, status?: string) => {
    if (type === 'tracking_update' && status) {
      if (status === 'delivered') return 'bg-green-500/10 text-green-500 border-green-500/20';
      if (status === 'returned') return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      if (status === 'cancelled' || status === 'failed_delivery') return 'bg-red-500/10 text-red-500 border-red-500/20';
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }

    switch (type) {
      case 'order_created':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'order_confirmed':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'order_dispatched':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'order_delivered':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'order_returned':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'order_cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'tracking_update':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Timeline content component
  const TimelineContent = () => (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-sm text-muted-foreground">Loading activity timeline...</div>
        </div>
      ) : timeline.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-2 text-center">
          <Clock className="h-12 w-12 text-muted-foreground/30" />
          <div className="text-sm text-muted-foreground">No activity recorded yet</div>
          <div className="text-xs text-muted-foreground">Activities will appear here as actions are taken</div>
        </div>
      ) : (
        <ScrollArea className="h-[350px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            
            <div className="space-y-3">
              {timeline.map((event) => (
                <div key={event.id} className="relative pl-11">
                  {/* Timeline dot */}
                  <div className={`absolute left-3 top-1 p-1 rounded-full border bg-background ${getEventColor(event.type, event.status)}`}>
                    {getEventIcon(event.type)}
                  </div>

                  <div className="border rounded-lg p-3 bg-card space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${getEventColor(event.type, event.status)}`}>
                        {event.title}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.timestamp), 'MMM d')} • {format(new Date(event.timestamp), 'hh:mm a')}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                    
                    {/* Special handling for status change events - show badges */}
                    {isStatusChangeEvent(event) && renderStatusTransition(event.details)}
                    
                    {/* Regular description for non-status-change events */}
                    {event.description && !isStatusChangeEvent(event) && (
                      <p className="text-sm text-foreground">{event.description}</p>
                    )}

                    {event.user && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{event.user.full_name}</span>
                      </div>
                    )}

                    {event.details && Object.keys(event.details).length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground">
                            <Info className="h-3 w-3 mr-1" />
                            Show details
                            <ChevronDown className="h-3 w-3 ml-1 transition-transform duration-200 [[data-state=open]>&]:rotate-180" />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="bg-muted/50 rounded p-2 mt-2 text-xs space-y-1">
                            {Object.entries(event.details).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="font-medium text-foreground capitalize">
                                  {key.replace(/_/g, ' ')}:
                                </span>
                                <span className="text-muted-foreground truncate">
                                  {typeof value === 'object' 
                                    ? JSON.stringify(value) 
                                    : String(value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      )}
    </>
  );

  // If embedded mode, render content directly without Dialog
  if (embedded) {
    return <TimelineContent />;
  }

  // Otherwise render with Dialog wrapper
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Order Activity Timeline</DialogTitle>
          <DialogDescription>
            Complete history of order lifecycle events and tracking updates
          </DialogDescription>
        </DialogHeader>
        <TimelineContent />
      </DialogContent>
    </Dialog>
  );
}
