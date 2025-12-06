import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Clock, Truck, Package, ExternalLink, ChevronLeft, ChevronRight, RefreshCw, XCircle, Send, Loader2, CloudDownload } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { PageContainer, PageHeader, StatsGrid, StatsCard } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
interface StuckOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  city: string;
  status: string;
  courier: string | null;
  tracking_id: string | null;
  updated_at: string;
  created_at: string;
  total_amount: number;
  days_stuck: number;
  last_tracking_update?: string;
}
const ITEMS_PER_PAGE = 50;
const StuckOrdersDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stuckType, setStuckType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    operation: string;
    title: string;
    description: string;
    count: number;
  } | null>(null);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoISO = twoDaysAgo.toISOString();

  // Separate count queries for accurate stats
  const {
    data: stats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['stuck-orders-stats'],
    queryFn: async () => {
      const [totalResult, atOurEndResult, atCourierEndResult, bookedWithTrackingResult] = await Promise.all([supabase.from('orders').select('*', {
        count: 'exact',
        head: true
      }).not('status', 'in', '(cancelled,returned,delivered)').lt('updated_at', twoDaysAgoISO), supabase.from('orders').select('*', {
        count: 'exact',
        head: true
      }).in('status', ['pending', 'booked']).lt('updated_at', twoDaysAgoISO), supabase.from('orders').select('*', {
        count: 'exact',
        head: true
      }).eq('status', 'dispatched').lt('updated_at', twoDaysAgoISO),
      // Booked orders with tracking (candidates for auto-dispatch)
      supabase.from('orders').select('*', {
        count: 'exact',
        head: true
      }).eq('status', 'booked').not('tracking_id', 'is', null).neq('tracking_id', '').lt('updated_at', twoDaysAgoISO)]);
      return {
        total: totalResult.count || 0,
        atOurEnd: atOurEndResult.count || 0,
        atCourierEnd: atCourierEndResult.count || 0,
        bookedWithTracking: bookedWithTrackingResult.count || 0
      };
    }
  });

  // Paginated orders query
  const {
    data: ordersData,
    isLoading,
    refetch: refetchOrders
  } = useQuery({
    queryKey: ['stuck-orders', stuckType, page, searchQuery],
    queryFn: async () => {
      let query = supabase.from('orders').select('id, order_number, customer_name, customer_phone, city, status, courier, tracking_id, updated_at, created_at, total_amount').not('status', 'in', '(cancelled,returned,delivered)').lt('updated_at', twoDaysAgoISO);
      if (stuckType === 'our_end') {
        query = query.in('status', ['pending', 'booked']);
      } else if (stuckType === 'courier_end') {
        query = query.eq('status', 'dispatched');
      }
      if (searchQuery.trim()) {
        query = query.or(`order_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`);
      }
      const {
        data: orders,
        error
      } = await query.order('updated_at', {
        ascending: true
      }).range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);
      if (error) throw error;
      const enrichedOrders: StuckOrder[] = orders?.map(order => {
        const daysStuck = differenceInDays(new Date(), new Date(order.updated_at));
        return {
          ...order,
          days_stuck: daysStuck
        };
      }) || [];
      return {
        orders: enrichedOrders,
        totalCount: stuckType === 'all' ? stats?.total || 0 : stuckType === 'our_end' ? stats?.atOurEnd || 0 : stats?.atCourierEnd || 0
      };
    },
    enabled: !!stats
  });

  // Critical count
  const {
    data: criticalCount
  } = useQuery({
    queryKey: ['stuck-orders-critical'],
    queryFn: async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const {
        count
      } = await supabase.from('orders').select('*', {
        count: 'exact',
        head: true
      }).not('status', 'in', '(cancelled,returned,delivered)').lt('updated_at', fiveDaysAgo.toISOString());
      return count || 0;
    }
  });

  // Old orders count (30+ days)
  const {
    data: oldOrdersCount
  } = useQuery({
    queryKey: ['old-orders-count'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const {
        count
      } = await supabase.from('orders').select('*', {
        count: 'exact',
        head: true
      }).in('status', ['pending', 'booked']).lt('created_at', thirtyDaysAgo.toISOString());
      return count || 0;
    }
  });
  const totalPages = Math.ceil((ordersData?.totalCount || 0) / ITEMS_PER_PAGE);
  const getStuckBadgeVariant = (days: number) => {
    if (days >= 5) return 'destructive';
    if (days >= 3) return 'secondary';
    return 'outline';
  };
  const getStuckLabel = (order: StuckOrder) => {
    if (['pending', 'booked'].includes(order.status)) {
      return 'Our End';
    }
    return 'At Courier';
  };
  const handleTabChange = (value: string) => {
    setStuckType(value);
    setPage(0);
  };
  const refreshAll = () => {
    refetchStats();
    refetchOrders();
    queryClient.invalidateQueries({
      queryKey: ['old-orders-count']
    });
  };

  // Bulk cleanup operations
  const runBulkOperation = async (operation: string, ageThresholdDays: number = 2) => {
    setIsProcessing(operation);
    const aggregatedResults = {
      processed: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      batchesProcessed: 0
    };
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    try {
      toast({
        description: `Starting ${operation.replace('_', ' ')}...`
      });
      while (hasMore) {
        const {
          data,
          error
        } = await supabase.functions.invoke('bulk-cleanup-stuck-orders', {
          body: {
            operation,
            ageThresholdDays,
            limit,
            offset
          }
        });
        if (error) throw error;
        if (data?.success) {
          aggregatedResults.processed += data.processed;
          aggregatedResults.success += data.success;
          aggregatedResults.failed += data.failed;
          aggregatedResults.skipped += data.skipped || 0;
          aggregatedResults.batchesProcessed++;
          hasMore = data.hasMore;
          offset += limit;
          toast({
            description: `Processed ${aggregatedResults.processed} orders (batch ${aggregatedResults.batchesProcessed})...`
          });
        } else {
          hasMore = false;
          if (data?.error) throw new Error(data.error);
        }
      }
      toast({
        title: "Operation Complete",
        description: `Processed ${aggregatedResults.processed}: ${aggregatedResults.success} success, ${aggregatedResults.failed} failed, ${aggregatedResults.skipped} skipped`
      });
      refreshAll();
    } catch (error: any) {
      console.error('Bulk operation error:', error);
      toast({
        title: "Operation Failed",
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(null);
      setConfirmDialog(null);
    }
  };

  // Update all tracking (reuse nightly-tracking-update)
  const runTrackingUpdate = async () => {
    setIsProcessing('tracking');
    const aggregatedResults = {
      total: 0,
      updated: 0,
      delivered: 0,
      returned: 0,
      failed: 0,
      noChange: 0,
      batchesProcessed: 0
    };
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    try {
      toast({
        description: "Starting tracking update for all dispatched orders..."
      });
      while (hasMore) {
        const {
          data,
          error
        } = await supabase.functions.invoke('nightly-tracking-update', {
          body: {
            trigger: 'manual',
            offset,
            limit
          }
        });
        if (error) throw error;
        if (data?.success) {
          const r = data.results;
          aggregatedResults.total += r.total;
          aggregatedResults.updated += r.updated;
          aggregatedResults.delivered += r.delivered;
          aggregatedResults.returned += r.returned;
          aggregatedResults.failed += r.failed;
          aggregatedResults.noChange += r.noChange;
          aggregatedResults.batchesProcessed++;
          hasMore = data.hasMore;
          offset += limit;
          toast({
            description: `Checked ${aggregatedResults.total} orders (batch ${aggregatedResults.batchesProcessed})...`
          });
        } else {
          hasMore = false;
        }
      }
      toast({
        title: "Tracking Update Complete",
        description: `Checked ${aggregatedResults.total} orders: ${aggregatedResults.delivered} delivered, ${aggregatedResults.returned} returned`
      });
      refreshAll();
    } catch (error: any) {
      console.error('Tracking update error:', error);
      toast({
        title: "Tracking Update Failed",
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(null);
      setConfirmDialog(null);
    }
  };
  // Sync from Shopify
  const runShopifySync = async () => {
    setIsProcessing('shopify_sync');
    const aggregatedResults = {
      total: 0,
      processed: 0,
      updated: 0,
      cancelled: 0,
      skipped: 0,
      errors: 0,
      batchesProcessed: 0
    };
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    try {
      toast({
        description: "Starting Shopify sync for pending orders..."
      });

      while (hasMore) {
        const { data, error } = await supabase.functions.invoke('backfill-shopify-fulfillments', {
          body: { offset, limit, includeAllPending: true, checkCancelled: true }
        });

        if (error) throw error;

        if (data?.success) {
          aggregatedResults.total = data.total;
          aggregatedResults.processed = data.processed;
          aggregatedResults.updated += data.updated;
          aggregatedResults.cancelled += data.cancelled;
          aggregatedResults.skipped += data.skipped;
          aggregatedResults.errors += data.errors;
          aggregatedResults.batchesProcessed++;
          hasMore = data.hasMore;
          offset = data.nextOffset || offset + limit;

          toast({
            description: `Processed ${data.processed} of ${data.total} orders (batch ${aggregatedResults.batchesProcessed})...`
          });
        } else {
          hasMore = false;
          if (data?.error) throw new Error(data.error);
        }
      }

      toast({
        title: "Shopify Sync Complete",
        description: `Processed ${aggregatedResults.processed}: ${aggregatedResults.updated} updated, ${aggregatedResults.cancelled} cancelled, ${aggregatedResults.skipped} skipped`
      });

      refreshAll();
    } catch (error: any) {
      console.error('Shopify sync error:', error);
      toast({
        title: "Shopify Sync Failed",
        description: error.message || 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(null);
      setConfirmDialog(null);
    }
  };

  // Get pending orders count for shopify sync
  const { data: pendingOrdersCount } = useQuery({
    queryKey: ['pending-orders-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('shopify_order_id', 'is', null)
        .in('status', ['pending', 'confirmed', 'booked']);
      return count || 0;
    }
  });

  const openConfirmDialog = (operation: string) => {
    let title = '';
    let description = '';
    let count = 0;
    switch (operation) {
      case 'dispatch_booked':
        title = 'Mark Booked Orders as Dispatched';
        description = `This will create dispatch records and mark ${stats?.bookedWithTracking || 0} booked orders (with tracking) as dispatched. These orders have tracking IDs but were never marked as dispatched.`;
        count = stats?.bookedWithTracking || 0;
        break;
      case 'tracking':
        title = 'Update All Tracking';
        description = `This will check courier tracking for ${stats?.atCourierEnd || 0} dispatched orders and auto-update status to delivered/returned based on courier responses.`;
        count = stats?.atCourierEnd || 0;
        break;
      case 'cancel_old':
        title = 'Cancel Old Orders';
        description = `This will cancel ${oldOrdersCount || 0} orders that are 30+ days old and still in pending/booked status. These orders will be marked as cancelled with reason "Order too old".`;
        count = oldOrdersCount || 0;
        break;
      case 'shopify_sync':
        title = 'Sync from Shopify';
        description = `This will check ${pendingOrdersCount || 0} pending orders against Shopify to sync fulfillment data (tracking ID, courier) and cancelled status. Orders fulfilled in Shopify will be updated to "booked" with tracking info.`;
        count = pendingOrdersCount || 0;
        break;
    }
    setConfirmDialog({
      open: true,
      operation,
      title,
      description,
      count
    });
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    switch (confirmDialog.operation) {
      case 'dispatch_booked':
        runBulkOperation('dispatch_booked', 2);
        break;
      case 'tracking':
        runTrackingUpdate();
        break;
      case 'cancel_old':
        runBulkOperation('cancel_old', 30);
        break;
      case 'shopify_sync':
        runShopifySync();
        break;
    }
  };
  return <PageContainer>
      <PageHeader title="Stuck Orders" description="Orders with no status or tracking updates for 2+ days" />

      {/* Cleanup Actions */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openConfirmDialog('shopify_sync')}
            disabled={isProcessing !== null}
          >
            {isProcessing === 'shopify_sync' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CloudDownload className="h-4 w-4 mr-2" />
            )}
            Sync from Shopify ({pendingOrdersCount?.toLocaleString() || 0})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openConfirmDialog('dispatch_booked')}
            disabled={isProcessing !== null}
          >
            {isProcessing === 'dispatch_booked' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Mark Booked as Dispatched ({stats?.bookedWithTracking?.toLocaleString() || 0})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openConfirmDialog('tracking')}
            disabled={isProcessing !== null}
          >
            {isProcessing === 'tracking' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Update All Tracking ({stats?.atCourierEnd?.toLocaleString() || 0})
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => openConfirmDialog('cancel_old')}
            disabled={isProcessing !== null}
            className="text-destructive hover:text-destructive"
          >
            {isProcessing === 'cancel_old' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Cancel Old Orders ({oldOrdersCount?.toLocaleString() || 0})
          </Button>
        </div>
      </Card>

      

      {/* Stats Cards */}
      <StatsGrid columns={4}>
        <StatsCard title="Total Stuck" value={stats?.total?.toLocaleString() || '0'} icon={AlertTriangle} description="Orders needing attention" variant="warning" />
        <StatsCard title="At Our End" value={stats?.atOurEnd?.toLocaleString() || '0'} icon={Package} description="Pending/Booked orders" variant="info" />
        <StatsCard title="At Courier End" value={stats?.atCourierEnd?.toLocaleString() || '0'} icon={Truck} description="Dispatched but no movement" variant="default" />
        <StatsCard title="Critical (5+ days)" value={criticalCount?.toLocaleString() || '0'} icon={Clock} description="Urgent attention needed" variant="danger" />
      </StatsGrid>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="Search by order number, customer, phone, city..." value={searchQuery} onChange={e => {
          setSearchQuery(e.target.value);
          setPage(0);
        }} className="pl-10" />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={stuckType} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">All Stuck ({stats?.total?.toLocaleString() || 0})</TabsTrigger>
          <TabsTrigger value="our_end">At Our End ({stats?.atOurEnd?.toLocaleString() || 0})</TabsTrigger>
          <TabsTrigger value="courier_end">At Courier End ({stats?.atCourierEnd?.toLocaleString() || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value={stuckType} className="space-y-4">
          {isLoading ? <div className="text-center py-8">Loading stuck orders...</div> : ordersData?.orders?.length === 0 ? <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">No stuck orders found!</p>
              <p className="text-muted-foreground">All orders are progressing normally.</p>
            </Card> : <>
              <div className="space-y-3">
                {ordersData?.orders?.map(order => <Card key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2 rounded-full ${order.days_stuck >= 5 ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                          <AlertTriangle className={`h-5 w-5 ${order.days_stuck >= 5 ? 'text-destructive' : 'text-warning'}`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link to={`/orders?order=${order.id}`} className="font-medium hover:underline flex items-center gap-1">
                              {order.order_number}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            <Badge variant={getStuckBadgeVariant(order.days_stuck)}>
                              {order.days_stuck} days stuck
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {order.status}
                            </Badge>
                            <Badge variant="secondary">
                              {getStuckLabel(order)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {order.customer_name} • {order.customer_phone} • {order.city}
                          </div>
                          {order.courier && <div className="text-sm text-muted-foreground">
                              Courier: <span className="font-medium">{order.courier}</span>
                              {order.tracking_id && <> • Tracking: <span className="font-mono">{order.tracking_id}</span></>}
                            </div>}
                        </div>

                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">Last Update</div>
                          <div>{formatDistanceToNow(new Date(order.updated_at))} ago</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            Rs. {order.total_amount?.toLocaleString()}
                          </div>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => window.open(`/orders?search=${encodeURIComponent(order.order_number)}`, '_blank')}>
                          View Order
                        </Button>
                      </div>
                    </div>
                  </Card>)}
              </div>

              {/* Pagination */}
              {totalPages > 1 && <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * ITEMS_PER_PAGE + 1} - {Math.min((page + 1) * ITEMS_PER_PAGE, ordersData?.totalCount || 0)} of {ordersData?.totalCount?.toLocaleString()} orders
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>}
            </>}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog?.open} onOpenChange={open => !open && setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isProcessing !== null || confirmDialog?.count === 0}>
              {isProcessing ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>;
};
export default StuckOrdersDashboard;