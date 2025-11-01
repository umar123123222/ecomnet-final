import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface Insight {
  type: 'success' | 'warning' | 'info';
  title: string;
  description: string;
  icon: any;
}

export function InventoryInsightsWidget() {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['inventory-insights'],
    queryFn: async () => {
      const insights: Insight[] = [];

      // Check for low stock items
      const { data: lowStock } = await supabase
        .from('inventory')
        .select(`
          id,
          quantity,
          product:products!inner (
            id,
            reorder_level
          )
        `);

      const lowStockCount = lowStock?.filter(item => 
        item.quantity <= (item.product?.reorder_level || 0)
      ).length || 0;

      if (lowStockCount > 0) {
        insights.push({
          type: 'warning',
          title: 'Low Stock Alert',
          description: `${lowStockCount} products are below their reorder level and need attention.`,
          icon: AlertCircle,
        });
      }

      // Check for overstocked items
      const { data: overstock } = await supabase
        .from('inventory')
        .select(`
          quantity,
          product:products (
            reorder_level
          )
        `);

      const overstockCount = overstock?.filter(item => {
        const reorderLevel = item.product?.reorder_level || 0;
        return item.quantity > reorderLevel * 5;
      }).length || 0;

      if (overstockCount > 0) {
        insights.push({
          type: 'info',
          title: 'Overstock Detected',
          description: `${overstockCount} products have stock levels 5x above reorder level. Consider promotions.`,
          icon: TrendingUp,
        });
      }

      // Check for items with high turnover
      const { data: movements } = await supabase
        .from('stock_movements')
        .select('product_id, quantity, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .eq('movement_type', 'sale');

      if (movements && movements.length > 0) {
        const productSales = movements.reduce((acc, mov) => {
          acc[mov.product_id] = (acc[mov.product_id] || 0) + mov.quantity;
          return acc;
        }, {} as Record<string, number>);

        const highTurnoverProducts = Object.keys(productSales).filter(
          id => productSales[id] > 100
        ).length;

        if (highTurnoverProducts > 0) {
          insights.push({
            type: 'success',
            title: 'High Performers',
            description: `${highTurnoverProducts} products sold over 100 units this month. Great performance!`,
            icon: CheckCircle,
          });
        }
      }

      // Check for zero stock
      const { data: zeroStock } = await supabase
        .from('inventory')
        .select('id')
        .eq('quantity', 0);

      if (zeroStock && zeroStock.length > 0) {
        insights.push({
          type: 'warning',
          title: 'Out of Stock',
          description: `${zeroStock.length} products are completely out of stock across all outlets.`,
          icon: AlertCircle,
        });
      }

      return insights;
    },
    staleTime: 300000, // 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Inventory Insights
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

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Inventory Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle className="h-12 w-12 mb-2 opacity-50 text-green-500" />
            <p className="text-sm">All inventory metrics look healthy!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getVariant = (type: string) => {
    switch (type) {
      case 'success': return 'default';
      case 'warning': return 'destructive';
      case 'info': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Inventory Insights
          </CardTitle>
          <Badge variant="outline">{insights.length} insights</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => {
            const Icon = insight.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{insight.title}</span>
                    <Badge variant={getVariant(insight.type)} className="text-xs">
                      {insight.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
