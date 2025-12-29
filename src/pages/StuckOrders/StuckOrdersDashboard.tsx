import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  AlertTriangle, Search, Clock, Truck, Package, ExternalLink, 
  ChevronLeft, ChevronRight, RefreshCw, Loader2, CheckCircle,
  Phone, MapPin, ArrowUpDown, Filter
} from 'lucide-react';
import { formatDistanceToNow, differenceInDays, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PageContainer, PageHeader, StatsGrid, StatsCard } from '@/components/layout';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from '@/hooks/useUserRoles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';

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

type SortOption = 'oldest' | 'newest' | 'days_stuck' | 'amount';

const StuckOrdersDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stuckType, setStuckType] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<TrackingJob | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('oldest');
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
              setActiveJob(newJob);
              if (newJob.status === 'completed') {
                toast({
                  title: "Tracking Update Complete",
                  description: `Processed ${newJob.last_processed_offset} orders: ${newJob.delivered_count} delivered, ${newJob.returned_count} returned`
                });
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

  // Separate count queries for accurate stats
  const {
    data: stats,
    refetch: refetchStats,
    isLoading: statsLoading
  } = useQuery({
    queryKey: ['stuck-orders-stats'],
    queryFn: async () => {
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

  // Paginated orders query
  const {
    data: ordersData,
    isLoading,
    refetch: refetchOrders
  } = useQuery({
    queryKey: ['stuck-orders', stuckType, page, searchQuery, sortBy],
    queryFn: async () => {
      const offset = page * ITEMS_PER_PAGE;
      
      const sortOrders = (orders: StuckOrder[]) => {
        switch (sortBy) {
          case 'newest':
            return orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          case 'days_stuck':
            return orders.sort((a, b) => b.days_stuck - a.days_stuck);
          case 'amount':
            return orders.sort((a, b) => (b.total_amount || 0) - (a.total_amount || 0));
          case 'oldest':
          default:
            return orders.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
      };
      
      if (stuckType === 'our_end') {
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
          orders: sortOrders(enrichedOrders),
          totalCount: stats?.atOurEnd || 0
        };
      } else if (stuckType === 'courier_end') {
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
          orders: sortOrders(enrichedOrders),
          totalCount: stats?.atCourierEnd || 0
        };
      } else {
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
        
        if (ourEndResult.error) throw ourEndResult.error;
        if (courierEndResult.error) throw courierEndResult.error;
        
        const ourEndOrders = (ourEndResult.data || []).map((order: any) => ({
          ...order,
          days_stuck: differenceInDays(new Date(), new Date(order.created_at))
        }));
        
        const courierEndOrders = (courierEndResult.data || []).map((order: any) => ({
          ...order,
          days_stuck: differenceInDays(new Date(), new Date(order.created_at)),
          last_tracking_update: order.last_tracking_check
        }));
        
        const allOrders = sortOrders([...ourEndOrders, ...courierEndOrders] as StuckOrder[])
          .slice(0, ITEMS_PER_PAGE);
        
        return {
          orders: allOrders,
          totalCount: stats?.total || 0
        };
      }
    },
    staleTime: 30000,
    enabled: !!stats
  });

  // Critical count
  const { data: criticalCount } = useQuery({
    queryKey: ['stuck-orders-critical'],
    queryFn: async () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '(cancelled,returned,delivered)')
        .lt('updated_at', fiveDaysAgo.toISOString());
      return count || 0;
    }
  });

  const totalPages = Math.ceil((ordersData?.totalCount || 0) / ITEMS_PER_PAGE);

  const getStuckSeverity = (days: number) => {
    if (days >= 7) return { color: 'bg-red-500', text: 'text-white', label: 'Critical' };
    if (days >= 5) return { color: 'bg-orange-500', text: 'text-white', label: 'Urgent' };
    if (days >= 3) return { color: 'bg-yellow-500', text: 'text-black', label: 'Warning' };
    return { color: 'bg-blue-500', text: 'text-white', label: 'Monitor' };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'booked': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'dispatched': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStuckLabel = (order: StuckOrder) => {
    if (['pending', 'booked'].includes(order.status)) return 'Our End';
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

  // Bulk operations
  const runBulkOperation = async (operation: string, ageThresholdDays: number = 2) => {
    setIsProcessing(operation);
    const aggregatedResults = { processed: 0, success: 0, failed: 0, skipped: 0, batchesProcessed: 0 };
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    
    try {
      toast({ description: `Starting ${operation.replace('_', ' ')}...` });
      while (hasMore) {
        const { data, error } = await supabase.functions.invoke('bulk-cleanup-stuck-orders', {
          body: { operation, ageThresholdDays, limit, offset }
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
          toast({ description: `Processed ${aggregatedResults.processed} orders (batch ${aggregatedResults.batchesProcessed})...` });
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
      toast({ title: "Operation Failed", description: error.message || 'An error occurred', variant: 'destructive' });
    } finally {
      setIsProcessing(null);
      setConfirmDialog(null);
    }
  };

  const runTrackingUpdate = async () => {
    setIsProcessing('tracking');
    try {
      const { data, error } = await supabase.functions.invoke('nightly-tracking-orchestrator', {
        body: { trigger: 'manual' }
      });
      if (error) throw error;
      toast({ description: "Tracking update started. Progress will update in real-time." });
    } catch (error: any) {
      console.error('Tracking update error:', error);
      toast({ title: "Tracking Update Failed", description: error.message || 'An error occurred', variant: 'destructive' });
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
    setConfirmDialog({ open: true, operation, title, description, count });
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    switch (confirmDialog.operation) {
      case 'tracking':
        runTrackingUpdate();
        break;
    }
  };

  const OrderCardSkeleton = () => (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-2 bg-muted shrink-0" />
          <div className="flex-1 p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
      <PageHeader 
        title="Stuck Orders" 
        description="Orders with no status or tracking updates for 2+ days"
      />

      {/* Progress Card for Active Job */}
      {activeJob && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-2">
                {activeJob.status === 'completed' ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : activeJob.status === 'failed' ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {activeJob.status === 'completed' 
                  ? 'Tracking Update Complete' 
                  : activeJob.status === 'failed'
                  ? 'Tracking Update Failed'
                  : 'Updating Tracking...'}
              </span>
              <span className="text-sm text-muted-foreground font-mono">
                {(activeJob.last_processed_offset || 0).toLocaleString()} / {(activeJob.total_orders || 0).toLocaleString()}
              </span>
            </div>
            
            <Progress 
              value={activeJob.total_orders > 0 
                ? ((activeJob.last_processed_offset || 0) / activeJob.total_orders) * 100 
                : 0
              } 
              className="h-2"
            />
            
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                Delivered: {(activeJob.delivered_count || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Returned: {(activeJob.returned_count || 0).toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                No Change: {(activeJob.no_change_count || 0).toLocaleString()}
              </span>
              
              {(activeJob.status === 'completed' || activeJob.status === 'failed') && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setActiveJob(null)}
                  className="ml-auto h-7 text-xs"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {statsLoading ? (
        <StatsGrid columns={4}>
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </StatsGrid>
      ) : (
        <StatsGrid columns={4}>
          <StatsCard 
            title="Total Stuck" 
            value={stats?.total?.toLocaleString() || '0'} 
            icon={AlertTriangle} 
            description="Orders needing attention" 
            variant="warning" 
          />
          <StatsCard 
            title="At Our End" 
            value={stats?.atOurEnd?.toLocaleString() || '0'} 
            icon={Package} 
            description="Pending/Booked orders" 
            variant="info" 
          />
          <StatsCard 
            title="At Courier End" 
            value={stats?.atCourierEnd?.toLocaleString() || '0'} 
            icon={Truck} 
            description="Dispatched but no movement" 
            variant="default" 
          />
          <StatsCard 
            title="Critical (5+ days)" 
            value={criticalCount?.toLocaleString() || '0'} 
            icon={Clock} 
            description="Urgent attention needed" 
            variant="danger" 
          />
        </StatsGrid>
      )}

      {/* Search and Filters */}
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <Input 
              placeholder="Search by order number, customer, phone, city..." 
              value={searchQuery} 
              onChange={e => {
                setSearchQuery(e.target.value);
                setPage(0);
              }} 
              className="pl-8 sm:pl-10 text-xs sm:text-sm h-9 sm:h-10" 
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full xs:w-[120px] sm:w-[140px] md:w-[160px] h-9 sm:h-10 text-xs sm:text-sm">
                <ArrowUpDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="oldest" className="text-xs sm:text-sm">Oldest First</SelectItem>
                <SelectItem value="newest" className="text-xs sm:text-sm">Newest First</SelectItem>
                <SelectItem value="days_stuck" className="text-xs sm:text-sm">Most Days Stuck</SelectItem>
                <SelectItem value="amount" className="text-xs sm:text-sm">Highest Amount</SelectItem>
              </SelectContent>
            </Select>
            
            {canPerformActions && (
              <Button
                variant="default"
                onClick={() => openConfirmDialog('tracking')}
                disabled={isProcessing !== null}
                className="flex-1 xs:flex-none h-9 sm:h-10 text-xs sm:text-sm px-3 sm:px-4"
              >
                {isProcessing === 'tracking' ? (
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                )}
                <span className="hidden xs:inline">Update Tracking</span>
                <span className="xs:hidden">Update</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={stuckType} onValueChange={handleTabChange} className="space-y-3 sm:space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1 gap-1">
          <TabsTrigger value="all" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm flex-col xs:flex-row">
            <span className="hidden sm:inline">All Stuck</span>
            <span className="sm:hidden">All</span>
            <Badge variant="secondary" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs font-medium">
              {stats?.total?.toLocaleString() || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="our_end" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm flex-col xs:flex-row">
            <span className="hidden sm:inline">At Our End</span>
            <span className="sm:hidden">Our End</span>
            <Badge variant="secondary" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs font-medium">
              {stats?.atOurEnd?.toLocaleString() || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="courier_end" className="gap-1 sm:gap-2 py-2 sm:py-2.5 text-xs sm:text-sm flex-col xs:flex-row">
            <span className="hidden sm:inline">At Courier</span>
            <span className="sm:hidden">Courier</span>
            <Badge variant="secondary" className="h-4 sm:h-5 px-1 sm:px-1.5 text-[10px] sm:text-xs font-medium">
              {stats?.atCourierEnd?.toLocaleString() || 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={stuckType} className="space-y-3 mt-4">
          {isLoading || !ordersData ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <OrderCardSkeleton key={i} />)}
            </div>
          ) : ordersData.orders.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No Stuck Orders!</h3>
              <p className="text-muted-foreground">All orders are progressing normally.</p>
            </Card>
          ) : (
            <>
              <div className="space-y-2">
                {ordersData.orders.map(order => {
                  const severity = getStuckSeverity(order.days_stuck);
                  
                  return (
                    <Card key={order.id} className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row">
                          {/* Severity Indicator */}
                          <div className={`w-full h-1 sm:h-1.5 md:w-1 md:h-auto lg:w-1.5 ${severity.color} shrink-0`} />
                          
                          {/* Main Content */}
                          <div className="flex-1 p-3 sm:p-4">
                            <div className="flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-3">
                              {/* Order Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                                  <Link 
                                    to={`/orders?order=${order.id}`} 
                                    className="font-semibold text-primary hover:underline flex items-center gap-1 text-sm sm:text-base"
                                  >
                                    {order.order_number}
                                    <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                  </Link>
                                  
                                  <Badge className={`${severity.color} ${severity.text} border-0 font-medium text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5`}>
                                    {order.days_stuck}d stuck
                                  </Badge>
                                  
                                  <Badge variant="outline" className={`${getStatusColor(order.status)} text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5`}>
                                    {order.status}
                                  </Badge>
                                  
                                  <Badge variant="secondary" className="font-normal text-[10px] sm:text-xs px-1.5 sm:px-2 py-0 sm:py-0.5">
                                    {getStuckLabel(order)}
                                  </Badge>
                                </div>
                                
                                {/* Customer Details */}
                                <div className="flex flex-wrap items-center gap-x-2 sm:gap-x-4 gap-y-0.5 sm:gap-y-1 text-xs sm:text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground truncate max-w-[150px] sm:max-w-none">{order.customer_name}</span>
                                  <span className="flex items-center gap-0.5 sm:gap-1">
                                    <Phone className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="truncate">{order.customer_phone}</span>
                                  </span>
                                  <span className="flex items-center gap-0.5 sm:gap-1">
                                    <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                                    <span className="truncate">{order.city}</span>
                                  </span>
                                </div>
                                
                                {/* Courier Info */}
                                {order.courier && (
                                  <div className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground">
                                    <span className="font-medium capitalize">{order.courier}</span>
                                    {order.tracking_id && (
                                      <span className="ml-1.5 sm:ml-2 font-mono text-[10px] sm:text-xs bg-muted px-1 sm:px-1.5 py-0.5 rounded truncate inline-block max-w-[120px] sm:max-w-none align-middle">
                                        {order.tracking_id}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Right Side Info */}
                              <div className="flex flex-row sm:flex-row lg:flex-col items-center sm:items-center lg:items-end justify-between sm:justify-start gap-2 lg:gap-1 text-xs sm:text-sm shrink-0 mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/50">
                                <div className="text-left sm:text-right">
                                  <div className="text-muted-foreground text-[10px] sm:text-xs">Last Update</div>
                                  <div className="font-medium text-xs sm:text-sm">{formatDistanceToNow(new Date(order.updated_at))} ago</div>
                                </div>
                                <div className="font-semibold text-sm sm:text-base lg:text-right">
                                  Rs. {order.total_amount?.toLocaleString() || 0}
                                </div>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                                  onClick={() => window.open(`/orders?search=${encodeURIComponent(order.order_number)}`, '_blank')}
                                >
                                  View Order
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Card className="p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
                    <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                      Showing <span className="font-medium">{page * ITEMS_PER_PAGE + 1}</span> - <span className="font-medium">{Math.min((page + 1) * ITEMS_PER_PAGE, ordersData?.totalCount || 0)}</span> of <span className="font-medium">{ordersData?.totalCount?.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPage(p => Math.max(0, p - 1))} 
                        disabled={page === 0}
                        className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden xs:inline ml-1">Prev</span>
                      </Button>
                      <div className="flex items-center px-2 sm:px-3 text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {page + 1}/{totalPages}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} 
                        disabled={page >= totalPages - 1}
                        className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
                      >
                        <span className="hidden xs:inline mr-1">Next</span>
                        <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              )}
            </>
          )}
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
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default StuckOrdersDashboard;
