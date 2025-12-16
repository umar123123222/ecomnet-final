import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, ArrowUp, ArrowDown, Minus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface VelocityItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  current_velocity: number;
  previous_velocity: number;
  change_percentage: number;
  trend: 'up' | 'down' | 'stable';
  category: 'fast' | 'medium' | 'slow';
}

export function SalesVelocityTracker() {
  const [expanded, setExpanded] = useState(false);
  
  const { data: velocityItems, isLoading } = useQuery({
    queryKey: ['sales-velocity'],
    queryFn: async () => {
      // Get sales from last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      // Current period (last 30 days)
      const { data: currentSales } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          quantity,
          product:products!inner (
            id,
            name,
            sku
          )
        `)
        .eq('movement_type', 'sale')
        .gte('created_at', thirtyDaysAgo);

      // Previous period (30-60 days ago)
      const { data: previousSales } = await supabase
        .from('stock_movements')
        .select('product_id, quantity')
        .eq('movement_type', 'sale')
        .gte('created_at', sixtyDaysAgo)
        .lt('created_at', thirtyDaysAgo);

      // Calculate current velocity
      const currentVelocityMap: Record<string, { name: string; sku: string; quantity: number }> = {};
      currentSales?.forEach((sale) => {
        if (!currentVelocityMap[sale.product_id]) {
          currentVelocityMap[sale.product_id] = {
            name: sale.product?.name || 'Unknown',
            sku: sale.product?.sku || 'N/A',
            quantity: 0,
          };
        }
        // Use absolute value since sale movements are stored as negative (deductions)
        currentVelocityMap[sale.product_id].quantity += Math.abs(sale.quantity);
      });

      // Calculate previous velocity
      const previousVelocityMap: Record<string, number> = {};
      previousSales?.forEach((sale) => {
        // Use absolute value since sale movements are stored as negative (deductions)
        previousVelocityMap[sale.product_id] = 
          (previousVelocityMap[sale.product_id] || 0) + Math.abs(sale.quantity);
      });

      // Generate velocity items
      const velocityItems: VelocityItem[] = Object.entries(currentVelocityMap)
        .map(([productId, data]) => {
          const currentVelocity = data.quantity / 30; // daily average
          const previousVelocity = (previousVelocityMap[productId] || 0) / 30;
          
          let changePercentage = 0;
          if (previousVelocity > 0) {
            changePercentage = ((currentVelocity - previousVelocity) / previousVelocity) * 100;
          } else if (currentVelocity > 0) {
            changePercentage = 100;
          }

          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (changePercentage > 10) trend = 'up';
          else if (changePercentage < -10) trend = 'down';

          let category: 'fast' | 'medium' | 'slow' = 'slow';
          if (currentVelocity > 5) category = 'fast';
          else if (currentVelocity > 2) category = 'medium';

          return {
            product_id: productId,
            product_name: data.name,
            product_sku: data.sku,
            current_velocity: parseFloat(currentVelocity.toFixed(2)),
            previous_velocity: parseFloat(previousVelocity.toFixed(2)),
            change_percentage: parseFloat(changePercentage.toFixed(1)),
            trend,
            category,
          };
        })
        .sort((a, b) => b.current_velocity - a.current_velocity)
        .slice(0, 10);

      return velocityItems;
    },
    staleTime: 300000, // 5 minutes
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'fast': return 'default';
      case 'medium': return 'secondary';
      case 'slow': return 'outline';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sales Velocity
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

  if (!velocityItems || velocityItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sales Velocity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No sales data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedItems = velocityItems.length > 3 && !expanded 
    ? velocityItems.slice(0, 3) 
    : velocityItems;

  return (
    <Card className="h-fit">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Sales Velocity
          </CardTitle>
          <Badge variant="outline">Top 10</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Daily sales rate comparison (30-day periods)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedItems.map((item) => (
            <div
              key={item.product_id}
              className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getCategoryColor(item.category)}>
                    {item.category}
                  </Badge>
                  <span className="font-medium text-sm truncate">
                    {item.product_name}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>SKU: {item.product_sku}</p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {item.current_velocity} units/day
                    </span>
                    <span className="flex items-center gap-1">
                      {getTrendIcon(item.trend)}
                      <span className={
                        item.change_percentage > 0 
                          ? 'text-green-600' 
                          : item.change_percentage < 0 
                          ? 'text-red-600' 
                          : ''
                      }>
                        {item.change_percentage > 0 ? '+' : ''}
                        {item.change_percentage}%
                      </span>
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
          {velocityItems.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  Show All ({velocityItems.length} products)
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
