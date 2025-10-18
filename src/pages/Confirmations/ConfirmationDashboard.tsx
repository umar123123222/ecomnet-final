import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmationWithDetails } from '@/types/confirmation';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Search, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

const ConfirmationDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: confirmations, isLoading } = useQuery({
    queryKey: ['all-confirmations', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('order_confirmations')
        .select(`
          *,
          order:orders(order_number, total_amount, customer_name, customer_phone, city),
          customer:customers(name, phone, whatsapp_opt_in)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConfirmationWithDetails[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['confirmation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_confirmations')
        .select('status');

      if (error) throw error;

      const statsByStatus = data.reduce((acc, conf) => {
        acc[conf.status] = (acc[conf.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        total: data.length,
        pending: statsByStatus.pending || 0,
        sent: statsByStatus.sent || 0,
        confirmed: statsByStatus.confirmed || 0,
        failed: statsByStatus.failed || 0,
        cancelled: statsByStatus.cancelled || 0,
        expired: statsByStatus.expired || 0,
      };
    },
  });

  const filteredConfirmations = confirmations?.filter(conf =>
    conf.order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conf.order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conf.order.customer_phone.includes(searchQuery)
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Order Confirmations</h1>
          <p className="text-muted-foreground">Track and manage order confirmation status</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{stats?.total || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-blue-600">{stats?.pending || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Sent</div>
          <div className="text-2xl font-bold text-purple-600">{stats?.sent || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Confirmed</div>
          <div className="text-2xl font-bold text-green-600">{stats?.confirmed || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Failed</div>
          <div className="text-2xl font-bold text-orange-600">{stats?.failed || 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Cancelled</div>
          <div className="text-2xl font-bold text-red-600">{stats?.cancelled || 0}</div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by order number, customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredConfirmations?.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No confirmations found</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredConfirmations?.map((confirmation) => (
                <Card key={confirmation.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div>{getStatusIcon(confirmation.status)}</div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Link 
                            to={`/orders?order=${confirmation.order_id}`}
                            className="font-medium hover:underline"
                          >
                            {confirmation.order.order_number}
                          </Link>
                          <Badge variant="outline" className="capitalize">
                            {confirmation.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {confirmation.order.customer_name} • {confirmation.order.customer_phone}
                        </div>
                      </div>

                      <div className="text-right text-sm">
                        {confirmation.sent_at ? (
                          <div>
                            <div className="text-muted-foreground">Sent</div>
                            <div>{formatDistanceToNow(new Date(confirmation.sent_at))} ago</div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-muted-foreground">Created</div>
                            <div>{formatDistanceToNow(new Date(confirmation.created_at))} ago</div>
                          </div>
                        )}
                      </div>

                      {confirmation.retry_count > 0 && (
                        <Badge variant="secondary">
                          {confirmation.retry_count} retries
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfirmationDashboard;
