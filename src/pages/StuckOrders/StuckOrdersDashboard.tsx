import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Search, Clock, Truck, Package, ExternalLink, ChevronLeft, ChevronRight, RefreshCw, Loader2, CheckCircle } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { PageContainer, PageHeader, StatsGrid, StatsCard } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from '@/hooks/useUserRoles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface TrackingJob {
  id: string;
  status: string;
  total_orders: number;
  last_processed_offset: number;
  delivered_count: number;
  returned_count: number;
  failed_count: number;
  no_change_count: number;
  started_at: string;
  completed_at: string | null;
}
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
  const [activeJob, setActiveJob] = useState<TrackingJob | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    operation: string;
    title: string;
    description: string;
    count: number;
  } | null>(null);
  const { toast } = useToast();
  const { primaryRole } = useUserRoles();
  const queryClient = useQueryClient();
  const canPerformActions = primaryRole !== 'finance';

  // Fetch active tracking job on mount
  useEffect(() => {
    const fetchActiveJob = async () => {
      const { data } = await supabase
        .from('tracking_update_jobs')
        .select('*')
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (data) {
        setActiveJob(data as TrackingJob);
      }
    };
    
    fetchActiveJob();
  }, []);

  // Real-time subscription to tracking jobs
  useEffect(() => {
    const channel = supabase
      .channel('tracking-jobs-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tracking_update_jobs'
        },
        (payload) => {
          console.log('Tracking job update:', payload);
          const newJob = payload.new as TrackingJob;
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            if (newJob.status === 'running') {
              setActiveJob(newJob);
            } else if (newJob.status === 'completed' || newJob.status === 'failed') {
              // Keep showing for a moment then clear
              setActiveJob(newJob);
              if (newJob.status === 'completed') {
                toast({
                  title: "Tracking Update Complete",
                  description: `Processed ${newJob.last_processed_offset} orders: ${newJob.delivered_count} delivered, ${newJob.returned_count} returned`
                });
                // Refresh stats
                queryClient.invalidateQueries({ queryKey: ['stuck-orders-stats'] });
                queryClient.invalidateQueries({ queryKey: ['stuck-orders'] });
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, queryClient]);

  // Separate count queries for accurate stats using database functions
  const {
    data: stats,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['stuck-orders-stats'],
    queryFn: async () => {
      // Use database functions for accurate counting
      const [atOurEndResult, atCourierEndResult] = await Promise.all([
        supabase.rpc('get_stuck_at_our_end_count'),
        supabase.rpc('get_stuck_at_courier_count')
      ]);
      
      const atOurEnd = atOurEndResult.data || 0;
      const atCourierEnd = atCourierEndResult.data || 0;
      
      return {
        total: atOurEnd + atCourierEnd,
        atOurEnd,
        atCourierEnd
      };
    }
  });

  // Paginated orders query using database functions
  const {
    data: ordersData,
    isLoading,
    refetch: refetchOrders
  } = useQuery({
    queryKey: ['stuck-orders', stuckType, page, searchQuery],
    queryFn: async () => {
      const offset = page * ITEMS_PER_PAGE;
      
      if (stuckType === 'our_end') {
        // Use database function for "At Our End" orders
        const { data, error } = await supabase.rpc('get_stuck_orders_at_our_end', {
          search_query: searchQuery.trim(),
          page_offset: offset,
          page_limit: ITEMS_PER_PAGE
        });
        if (error) throw error;
        
        const enrichedOrders: StuckOrder[] = (data || []).map((order: any) => ({
          ...order,
          days_stuck: differenceInDays(new Date(), new Date(order.created_at))
        }));
        
        return {
          orders: enrichedOrders,
          totalCount: stats?.atOurEnd || 0
        };
      } else if (stuckType === 'courier_end') {
        // Use database function for "At Courier End" orders
        const { data, error } = await supabase.rpc('get_stuck_orders_at_courier_end', {
          search_query: searchQuery.trim(),
          page_offset: offset,
          page_limit: ITEMS_PER_PAGE
        });
        if (error) throw error;
        
        const enrichedOrders: StuckOrder[] = (data || []).map((order: any) => ({
          ...order,
          days_stuck: differenceInDays(new Date(), new Date(order.created_at)),
          last_tracking_update: order.last_tracking_check
        }));
        
        return {
          orders: enrichedOrders,
          totalCount: stats?.atCourierEnd || 0
        };
      } else {
        // "All" tab - fetch both using functions
        const [ourEndResult, courierEndResult] = await Promise.all([
          supabase.rpc('get_stuck_orders_at_our_end', {
            search_query: searchQuery.trim(),
            page_offset: offset,
            page_limit: ITEMS_PER_PAGE
          }),
          supabase.rpc('get_stuck_orders_at_courier_end', {
            search_query: searchQuery.trim(),
            page_offset: offset,
            page_limit: ITEMS_PER_PAGE
          })
        ]);
        
        const ourEndOrders = (ourEndResult.data || []).map((order: any) => ({
          ...order,
          days_stuck: differenceInDays(new Date(), new Date(order.created_at))
        }));
        
        const courierEndOrders = (courierEndResult.data || []).map((order: any) => ({
          ...order,
          days_stuck: differenceInDays(new Date(), new Date(order.created_at)),
          last_tracking_update: order.last_tracking_check
        }));
        
        // Combine and sort by created_at
        const allOrders = [...ourEndOrders, ...courierEndOrders]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(0, ITEMS_PER_PAGE);
        
        return {
          orders: allOrders as StuckOrder[],
          totalCount: stats?.total || 0
        };
      }
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

  // Update all tracking - just triggers the orchestrator, progress comes via realtime
  const runTrackingUpdate = async () => {
    setIsProcessing('tracking');
    
    try {
      // Just trigger the first call - the orchestrator self-continues
      const { data, error } = await supabase.functions.invoke('nightly-tracking-orchestrator', {
        body: { trigger: 'manual' }
      });
      
      if (error) throw error;
      
      // The real-time subscription will handle progress updates
      toast({
        description: "Tracking update started. Progress will update in real-time."
      });
      
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

  const openConfirmDialog = (operation: string) => {
    let title = '';
    let description = '';
    let count = 0;
    switch (operation) {
      case 'tracking':
        title = 'Update All Tracking';
        description = `This will check courier tracking for ${stats?.atCourierEnd || 0} dispatched orders and auto-update status to delivered/returned based on courier responses.`;
        count = stats?.atCourierEnd || 0;
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
      case 'tracking':
        runTrackingUpdate();
        break;
    }
  };
  return <PageContainer>
      <PageHeader title="Stuck Orders" description="Orders with no status or tracking updates for 2+ days" />

      {/* Cleanup Actions - Hidden for finance users */}
      {canPerformActions && (
        <Card className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
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
          </div>
          
          {/* Progress Bar for Tracking Update - Shows for all users */}
          {activeJob && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  {activeJob.status === 'completed' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : activeJob.status === 'failed' ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  )}
                  {activeJob.status === 'completed' 
                    ? 'Tracking Update Complete' 
                    : activeJob.status === 'failed'
                    ? 'Tracking Update Failed'
                    : 'Updating Tracking...'}
                </span>
                <span className="text-muted-foreground">
                  {(activeJob.last_processed_offset || 0).toLocaleString()} / {(activeJob.total_orders || 0).toLocaleString()} orders
                </span>
              </div>
              
              <Progress 
                value={activeJob.total_orders > 0 
                  ? ((activeJob.last_processed_offset || 0) / activeJob.total_orders) * 100 
                  : 0
                } 
                className="h-2"
              />
              
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Delivered: {(activeJob.delivered_count || 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Returned: {(activeJob.returned_count || 0).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  No Change: {(activeJob.no_change_count || 0).toLocaleString()}
                </span>
              </div>
              
              {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveJob(null)}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

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