import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AgingItem {
  product_name: string;
  product_sku: string;
  outlet_name: string;
  quantity: number;
  last_movement: string | null;
  days_stagnant: number;
}

export function StockAgingAnalysis() {
  const { data: agingItems, isLoading } = useQuery({
    queryKey: ['stock-aging'],
    queryFn: async () => {
      const { data: inventory, error } = await supabase
        .from('inventory')
        .select(`
          quantity,
          updated_at,
          product:products!inner (
            id,
            name,
            sku
          ),
          outlet:outlets!inner (
            id,
            name
          )
        `)
        .gt('quantity', 0);

      if (error) throw error;

      // Get last movement for each inventory item
      const items: AgingItem[] = [];
      
      for (const inv of inventory) {
        if (!inv.product?.id || !inv.outlet?.id) continue;
        
        const { data: movements } = await supabase
          .from('stock_movements')
          .select('created_at')
          .eq('product_id', inv.product.id)
          .eq('outlet_id', inv.outlet.id)
          .order('created_at', { ascending: false })
          .limit(1);

        const lastMovement = movements?.[0]?.created_at || inv.updated_at;
        const daysSinceMovement = Math.floor(
          (Date.now() - new Date(lastMovement).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceMovement > 30) {
          items.push({
            product_name: inv.product?.name || 'Unknown',
            product_sku: inv.product?.sku || 'N/A',
            outlet_name: inv.outlet?.name || 'Unknown',
            quantity: inv.quantity,
            last_movement: lastMovement,
            days_stagnant: daysSinceMovement,
          });
        }
      }

      // Sort by days stagnant (oldest first)
      return items.sort((a, b) => b.days_stagnant - a.days_stagnant).slice(0, 10);
    },
    staleTime: 300000, // 5 minutes
  });

  const getSeverityColor = (days: number) => {
    if (days > 180) return 'destructive';
    if (days > 90) return 'default';
    return 'secondary';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stock Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!agingItems || agingItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stock Aging Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No stagnant stock detected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Stock Aging Analysis
          </CardTitle>
          <Badge variant="outline">{agingItems.length} items</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Items with no movement for over 30 days
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {agingItems.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getSeverityColor(item.days_stagnant)}>
                    {item.days_stagnant} days
                  </Badge>
                  <span className="font-medium text-sm truncate">
                    {item.product_name}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>SKU: {item.product_sku} • Outlet: {item.outlet_name}</p>
                  <p className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Quantity: {item.quantity} • Last movement:{' '}
                    {item.last_movement ? formatDistanceToNow(new Date(item.last_movement), { addSuffix: true }) : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
