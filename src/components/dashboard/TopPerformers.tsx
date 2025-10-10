import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Package, Users, Loader2 } from 'lucide-react';

export const TopPerformers: React.FC = () => {
  // Top Staff by performance
  const { data: topStaff, isLoading: staffLoading } = useQuery({
    queryKey: ['top-staff'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_performance')
        .select('user_id, orders_processed, returns_handled, addresses_verified')
        .order('orders_processed', { ascending: false })
        .limit(5);

      // Fetch user details separately
      const userIds = data?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      return data?.map(staff => {
        const profile = profiles?.find(p => p.id === staff.user_id);
        return {
          id: staff.user_id,
          name: profile?.full_name || 'Unknown',
          email: profile?.email,
          ordersProcessed: staff.orders_processed,
          returnsHandled: staff.returns_handled,
          addressesVerified: staff.addresses_verified,
        };
      }) || [];
    },
  });

  // Top Products by orders
  const { data: topProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['top-products'],
    queryFn: async () => {
      // This would need a proper aggregation query
      // For now, returning sample data
      const { data: products } = await supabase
        .from('products')
        .select('id, name, sku, price')
        .eq('is_active', true)
        .limit(5);

      return products?.map(p => ({
        ...p,
        orderCount: Math.floor(Math.random() * 100) + 20, // Mock data
      })) || [];
    },
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Top Performers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="staff" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="staff">
              <Users className="h-4 w-4 mr-2" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-4 mt-4">
            {staffLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {topStaff?.map((staff, index) => (
                  <div
                    key={staff.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Badge variant={index === 0 ? 'default' : 'secondary'} className="text-xs">
                        #{index + 1}
                      </Badge>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {getInitials(staff.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{staff.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {staff.email}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{staff.ordersProcessed}</p>
                      <p className="text-xs text-muted-foreground">orders</p>
                    </div>
                  </div>
                ))}
                {(!topStaff || topStaff.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No staff performance data
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-4 mt-4">
            {productsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {topProducts?.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Badge variant={index === 0 ? 'default' : 'secondary'} className="text-xs">
                      #{index + 1}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{product.orderCount}</p>
                      <p className="text-xs text-muted-foreground">orders</p>
                    </div>
                  </div>
                ))}
                {(!topProducts || topProducts.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No product data
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
