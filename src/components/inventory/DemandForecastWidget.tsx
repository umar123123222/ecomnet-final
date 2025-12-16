import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface ForecastItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  current_stock: number;
  avg_daily_sales: number;
  forecast_7_days: number;
  forecast_30_days: number;
  recommended_reorder: number;
  stock_out_risk: 'low' | 'medium' | 'high';
}

export function DemandForecastWidget() {
  const [timeframe, setTimeframe] = useState<'7' | '30'>('7');
  const [expanded, setExpanded] = useState(false);

  const { data: forecasts, isLoading } = useQuery({
    queryKey: ['demand-forecast', timeframe],
    queryFn: async () => {
      // Get sales data from the last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: salesMovements, error } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          quantity,
          created_at,
          product:products!inner (
            id,
            name,
            sku,
            reorder_level
          )
        `)
        .eq('movement_type', 'sale')
        .gte('created_at', ninetyDaysAgo);

      if (error) throw error;

      // Calculate sales velocity per product
      const productSales: Record<string, { name: string; sku: string; sales: number[]; reorder_level: number }> = {};

      salesMovements?.forEach((movement) => {
        const productId = movement.product_id;
        if (!productSales[productId]) {
          productSales[productId] = {
            name: movement.product?.name || 'Unknown',
            sku: movement.product?.sku || 'N/A',
            sales: [],
            reorder_level: movement.product?.reorder_level || 0,
          };
        }
        // Use absolute value since sale movements are stored as negative (deductions)
        productSales[productId].sales.push(Math.abs(movement.quantity));
      });

      // Get current inventory levels
      const { data: inventory } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .in('product_id', Object.keys(productSales));

      const inventoryMap = inventory?.reduce((acc, inv) => {
        acc[inv.product_id] = inv.quantity;
        return acc;
      }, {} as Record<string, number>) || {};

      // Calculate forecasts
      const forecasts: ForecastItem[] = Object.entries(productSales)
        .map(([productId, data]) => {
          const totalSales = data.sales.reduce((sum, qty) => sum + qty, 0);
          const avgDailySales = totalSales / 90;
          const currentStock = inventoryMap[productId] || 0;
          
          const forecast7Days = Math.ceil(avgDailySales * 7);
          const forecast30Days = Math.ceil(avgDailySales * 30);
          
          // Calculate stock-out risk
          const daysUntilStockOut = avgDailySales > 0 ? currentStock / avgDailySales : 999;
          let stockOutRisk: 'low' | 'medium' | 'high' = 'low';
          
          if (daysUntilStockOut < 7) stockOutRisk = 'high';
          else if (daysUntilStockOut < 14) stockOutRisk = 'medium';
          
          const recommendedReorder = Math.max(
            Math.ceil(forecast30Days * 1.2), // 20% buffer
            data.reorder_level
          );

          return {
            product_id: productId,
            product_name: data.name,
            product_sku: data.sku,
            current_stock: currentStock,
            avg_daily_sales: parseFloat(avgDailySales.toFixed(2)),
            forecast_7_days: forecast7Days,
            forecast_30_days: forecast30Days,
            recommended_reorder: recommendedReorder,
            stock_out_risk: stockOutRisk,
          };
        })
        .filter(f => f.avg_daily_sales > 0)
        .sort((a, b) => {
          // Sort by risk level first, then by sales velocity
          const riskOrder = { high: 0, medium: 1, low: 2 };
          if (riskOrder[a.stock_out_risk] !== riskOrder[b.stock_out_risk]) {
            return riskOrder[a.stock_out_risk] - riskOrder[b.stock_out_risk];
          }
          return b.avg_daily_sales - a.avg_daily_sales;
        })
        .slice(0, 10);

      return forecasts;
    },
    staleTime: 300000, // 5 minutes
  });

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Demand Forecast
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

  if (!forecasts || forecasts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Demand Forecast
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Insufficient sales data for forecasting</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedForecasts = forecasts.length > 3 && !expanded 
    ? forecasts.slice(0, 3) 
    : forecasts;

  return (
    <Card className="h-fit">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Demand Forecast
          </CardTitle>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as '7' | '30')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          Based on 90-day sales history
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedForecasts.map((item) => (
            <div
              key={item.product_id}
              className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={getRiskColor(item.stock_out_risk)}>
                    {item.stock_out_risk} risk
                  </Badge>
                  <span className="font-medium text-sm truncate">
                    {item.product_name}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>SKU: {item.product_sku}</p>
                  <p>
                    Current Stock: {item.current_stock} • Daily Avg: {item.avg_daily_sales}
                  </p>
                  <p className="font-medium text-foreground">
                    {timeframe === '7' ? '7-day' : '30-day'} Forecast:{' '}
                    {timeframe === '7' ? item.forecast_7_days : item.forecast_30_days} units
                  </p>
                  <p className="text-primary">
                    Recommended Reorder: {item.recommended_reorder} units
                  </p>
                </div>
              </div>
            </div>
          ))}
          {forecasts.length > 3 && (
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
                  Show All ({forecasts.length} products)
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
