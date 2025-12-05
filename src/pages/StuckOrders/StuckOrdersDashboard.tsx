import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Clock, Truck, Package, ExternalLink } from 'lucide-react';
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

const StuckOrdersDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stuckType, setStuckType] = useState<string>('all');

  const { data: stuckOrders, isLoading } = useQuery({
    queryKey: ['stuck-orders', stuckType],
    queryFn: async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Get orders that are not cancelled, returned, or delivered
      // and haven't been updated in 2+ days
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_phone, city, status, courier, tracking_id, updated_at, created_at, total_amount')
        .not('status', 'in', '(cancelled,returned,delivered)')
        .lt('updated_at', twoDaysAgo.toISOString())
        .order('updated_at', { ascending: true });

      if (error) throw error;

      // Get latest tracking updates for orders with tracking
      const orderIds = orders?.map(o => o.id) || [];
      const { data: trackingHistory } = await supabase
        .from('courier_tracking_history')
        .select('order_id, checked_at')
        .in('order_id', orderIds)
        .order('checked_at', { ascending: false });

      // Map latest tracking per order
      const latestTrackingByOrder: Record<string, string> = {};
      trackingHistory?.forEach(t => {
        if (!latestTrackingByOrder[t.order_id]) {
          latestTrackingByOrder[t.order_id] = t.checked_at;
        }
      });

      // Calculate days stuck and categorize
      const enrichedOrders: StuckOrder[] = orders?.map(order => {
        const lastUpdate = latestTrackingByOrder[order.id] || order.updated_at;
        const daysStuck = differenceInDays(new Date(), new Date(lastUpdate));
        
        return {
          ...order,
          days_stuck: daysStuck,
          last_tracking_update: latestTrackingByOrder[order.id]
        };
      }) || [];

      // Filter by stuck type
      if (stuckType === 'our_end') {
        // Stuck at our end: pending or booked but no tracking update
        return enrichedOrders.filter(o => ['pending', 'booked'].includes(o.status));
      } else if (stuckType === 'courier_end') {
        // Stuck at courier end: dispatched but no tracking movement
        return enrichedOrders.filter(o => o.status === 'dispatched');
      }

      return enrichedOrders;
    },
  });

  const stats = {
    total: stuckOrders?.length || 0,
    atOurEnd: stuckOrders?.filter(o => ['pending', 'booked'].includes(o.status)).length || 0,
    atCourierEnd: stuckOrders?.filter(o => o.status === 'dispatched').length || 0,
    critical: stuckOrders?.filter(o => o.days_stuck >= 5).length || 0,
  };

  const filteredOrders = stuckOrders?.filter(order =>
    order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.customer_phone?.includes(searchQuery) ||
    order.city?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStuckBadgeVariant = (days: number) => {
    if (days >= 5) return 'destructive';
    if (days >= 3) return 'secondary';
    return 'outline';
  };

  const getStuckLabel = (order: StuckOrder) => {
    if (['pending', 'booked'].includes(order.status)) {
      return 'Stuck at Our End';
    }
    return 'Stuck at Courier';
  };

  return (
    <PageContainer>
      <PageHeader
        title="Stuck Orders"
        description="Orders with no status or tracking updates for 2+ days"
      />

      {/* Stats Cards */}
      <StatsGrid>
        <StatsCard
          title="Total Stuck"
          value={stats.total}
          icon={AlertTriangle}
          description="Orders needing attention"
        />
        <StatsCard
          title="At Our End"
          value={stats.atOurEnd}
          icon={Package}
          description="Pending/Booked orders"
        />
        <StatsCard
          title="At Courier End"
          value={stats.atCourierEnd}
          icon={Truck}
          description="Dispatched but no movement"
        />
        <StatsCard
          title="Critical (5+ days)"
          value={stats.critical}
          icon={Clock}
          description="Urgent attention needed"
        />
      </StatsGrid>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by order number, customer, phone, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={stuckType} onValueChange={setStuckType}>
        <TabsList>
          <TabsTrigger value="all">All Stuck ({stats.total})</TabsTrigger>
          <TabsTrigger value="our_end">At Our End ({stats.atOurEnd})</TabsTrigger>
          <TabsTrigger value="courier_end">At Courier End ({stats.atCourierEnd})</TabsTrigger>
        </TabsList>

        <TabsContent value={stuckType} className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading stuck orders...</div>
          ) : filteredOrders?.length === 0 ? (
            <Card className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">No stuck orders found!</p>
              <p className="text-muted-foreground">All orders are progressing normally.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredOrders?.map((order) => (
                <Card key={order.id} className="p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-full ${order.days_stuck >= 5 ? 'bg-destructive/10' : 'bg-orange-100 dark:bg-orange-900/20'}`}>
                        <AlertTriangle className={`h-5 w-5 ${order.days_stuck >= 5 ? 'text-destructive' : 'text-orange-500'}`} />
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
                        <div>{formatDistanceToNow(new Date(order.last_tracking_update || order.updated_at))} ago</div>
                        <div className="text-muted-foreground text-xs mt-1">
                          Rs. {order.total_amount.toLocaleString()}
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
          )}
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default StuckOrdersDashboard;
