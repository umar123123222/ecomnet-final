import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Clock, Truck, Package, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { PageContainer, PageHeader, StatsGrid, StatsCard } from '@/components/layout';

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

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoISO = twoDaysAgo.toISOString();

  // Separate count queries for accurate stats
  const { data: stats } = useQuery({
    queryKey: ['stuck-orders-stats'],
    queryFn: async () => {
      const [totalResult, atOurEndResult, atCourierEndResult] = await Promise.all([
        // Total stuck orders
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .not('status', 'in', '(cancelled,returned,delivered)')
          .lt('updated_at', twoDaysAgoISO),
        // At our end (pending/booked)
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'booked'])
          .lt('updated_at', twoDaysAgoISO),
        // At courier end (dispatched)
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'dispatched')
          .lt('updated_at', twoDaysAgoISO),
      ]);

      return {
        total: totalResult.count || 0,
        atOurEnd: atOurEndResult.count || 0,
        atCourierEnd: atCourierEndResult.count || 0,
      };
    },
  });

  // Paginated orders query
  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['stuck-orders', stuckType, page, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, city, status, courier, tracking_id, updated_at, created_at, total_amount')
        .not('status', 'in', '(cancelled,returned,delivered)')
        .lt('updated_at', twoDaysAgoISO);

      // Filter by stuck type
      if (stuckType === 'our_end') {
        query = query.in('status', ['pending', 'booked']);
      } else if (stuckType === 'courier_end') {
        query = query.eq('status', 'dispatched');
      }

      // Apply search filter
      if (searchQuery.trim()) {
        query = query.or(`order_number.ilike.%${searchQuery}%,customer_name.ilike.%${searchQuery}%,customer_phone.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`);
      }

      // Get total count for pagination
      const countQuery = query;
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '(cancelled,returned,delivered)')
        .lt('updated_at', twoDaysAgoISO)
        .or(stuckType === 'our_end' 
          ? 'status.in.(pending,booked)' 
          : stuckType === 'courier_end' 
            ? 'status.eq.dispatched' 
            : 'status.neq.never_match');

      // Apply pagination
      const { data: orders, error } = await query
        .order('updated_at', { ascending: true })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      // Calculate days stuck for each order
      const enrichedOrders: StuckOrder[] = orders?.map(order => {
        const daysStuck = differenceInDays(new Date(), new Date(order.updated_at));
        return {
          ...order,
          days_stuck: daysStuck,
        };
      }) || [];

      return {
        orders: enrichedOrders,
        totalCount: stuckType === 'all' ? stats?.total || 0 : 
                    stuckType === 'our_end' ? stats?.atOurEnd || 0 : 
                    stats?.atCourierEnd || 0,
      };
    },
    enabled: !!stats,
  });

  // Critical count (separate query)
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
    },
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

  return (
    <PageContainer>
      <PageHeader
        title="Stuck Orders"
        description="Orders with no status or tracking updates for 2+ days"
      />

      {/* Stats Cards */}
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

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by order number, customer, phone, city..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(0);
            }}
            className="pl-10"
          />
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
          {isLoading ? (
            <div className="text-center py-8">Loading stuck orders...</div>
          ) : ordersData?.orders?.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">No stuck orders found!</p>
              <p className="text-muted-foreground">All orders are progressing normally.</p>
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                {ordersData?.orders?.map((order) => (
                  <Card key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={`p-2 rounded-full ${order.days_stuck >= 5 ? 'bg-destructive/10' : 'bg-warning/10'}`}>
                          <AlertTriangle className={`h-5 w-5 ${order.days_stuck >= 5 ? 'text-destructive' : 'text-warning'}`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link 
                              to={`/orders?order=${order.id}`}
                              className="font-medium hover:underline flex items-center gap-1"
                            >
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
                          {order.courier && (
                            <div className="text-sm text-muted-foreground">
                              Courier: <span className="font-medium">{order.courier}</span>
                              {order.tracking_id && <> • Tracking: <span className="font-mono">{order.tracking_id}</span></>}
                            </div>
                          )}
                        </div>

                        <div className="text-right text-sm">
                          <div className="text-muted-foreground">Last Update</div>
                          <div>{formatDistanceToNow(new Date(order.updated_at))} ago</div>
                          <div className="text-muted-foreground text-xs mt-1">
                            Rs. {order.total_amount?.toLocaleString()}
                          </div>
                        </div>

                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/orders?order=${order.id}`}>
                            View Order
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {page * ITEMS_PER_PAGE + 1} - {Math.min((page + 1) * ITEMS_PER_PAGE, ordersData?.totalCount || 0)} of {ordersData?.totalCount?.toLocaleString()} orders
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default StuckOrdersDashboard;
