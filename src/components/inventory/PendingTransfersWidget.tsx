import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRoles } from '@/hooks/useUserRoles';

export const PendingTransfersWidget = () => {
  const { permissions } = useUserRoles();

  const { data: transfers, isLoading } = useQuery({
    queryKey: ['pending-transfers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_transfer_requests')
        .select(`
          *,
          from_outlet:outlets!stock_transfer_requests_from_outlet_id_fkey(id, name),
          to_outlet:outlets!stock_transfer_requests_to_outlet_id_fkey(id, name),
          items:stock_transfer_items(
            id,
            quantity_requested,
            product:products(id, name, sku)
          )
        `)
        .in('status', ['pending', 'approved', 'in_transit'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Pending Transfers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const pendingCount = transfers?.filter((t) => t.status === 'pending').length || 0;
  const approvedCount = transfers?.filter((t) => t.status === 'approved').length || 0;
  const inTransitCount = transfers?.filter((t) => t.status === 'in_transit').length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Pending Transfers
          </span>
          <Link to="/stock-transfer">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold">{pendingCount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold">{approvedCount}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">In Transit</p>
            <p className="text-2xl font-bold">{inTransitCount}</p>
          </div>
        </div>

        {transfers && transfers.length > 0 ? (
          <div className="space-y-2">
            {transfers.slice(0, 3).map((transfer) => (
              <div
                key={transfer.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          transfer.status === 'pending'
                            ? 'secondary'
                            : transfer.status === 'in_transit'
                            ? 'default'
                            : 'outline'
                        }
                      >
                        {transfer.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {transfer.status === 'in_transit' && <Package className="h-3 w-3 mr-1" />}
                        {transfer.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{transfer.from_outlet?.name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{transfer.to_outlet?.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {transfer.items?.length || 0} item(s)
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No pending transfers
          </div>
        )}

        {permissions.canCreateStockTransfer && transfers && transfers.length > 3 && (
          <Link to="/stock-transfer">
            <Button variant="ghost" className="w-full" size="sm">
              View {transfers.length - 3} more
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
