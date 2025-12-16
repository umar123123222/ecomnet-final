import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

interface TurnoverItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  avg_inventory: number;
  cogs: number; // Cost of goods sold
  turnover_ratio: number;
  turnover_days: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
}

export function InventoryTurnoverWidget() {
  const [expanded, setExpanded] = useState(false);
  const { data: turnoverData, isLoading } = useQuery({
    queryKey: ['inventory-turnover'],
    queryFn: async () => {
      // Get sales data from last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: salesData } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          quantity,
          product:products!inner (
            id,
            name,
            sku,
            cost
          )
        `)
        .eq('movement_type', 'sale')
        .gte('created_at', ninetyDaysAgo);

      // Calculate COGS (Cost of Goods Sold)
      const productCOGS: Record<string, { name: string; sku: string; cogs: number; cost: number; soldQty: number }> = {};

      salesData?.forEach((sale) => {
        const productId = sale.product_id;
        const cost = sale.product?.cost || 0;
        // Use absolute value since sale movements are stored as negative (deductions)
        const soldQty = Math.abs(sale.quantity);
        const cogs = soldQty * cost;

        if (!productCOGS[productId]) {
          productCOGS[productId] = {
            name: sale.product?.name || 'Unknown',
            sku: sale.product?.sku || 'N/A',
            cogs: 0,
            cost,
            soldQty: 0,
          };
        }
        productCOGS[productId].cogs += cogs;
        productCOGS[productId].soldQty += soldQty;
      });

      // Get current inventory levels
      const { data: inventory } = await supabase
        .from('inventory')
        .select('product_id, quantity')
        .in('product_id', Object.keys(productCOGS));

      // Calculate average inventory value and turnover
      const turnoverItems: TurnoverItem[] = [];

      for (const [productId, data] of Object.entries(productCOGS)) {
        const currentQty = inventory?.find(i => i.product_id === productId)?.quantity || 0;
        // Use sold quantity for turnover calculation if no current stock
        const avgQty = currentQty > 0 ? currentQty : data.soldQty;
        const avgInventoryValue = avgQty * data.cost;

        if (data.cogs > 0) {
          // Turnover Ratio = COGS / Average Inventory Value (annualized)
          // If avgInventoryValue is 0, use COGS/soldQty as proxy
          let turnoverRatio: number;
          let turnoverDays: number;
          
          if (avgInventoryValue > 0) {
            turnoverRatio = (data.cogs * (365 / 90)) / avgInventoryValue;
          } else {
            // For products with zero/negative inventory, base turnover on sold quantity
            turnoverRatio = data.soldQty > 0 ? (365 / 90) : 0;
          }
          
          turnoverDays = turnoverRatio > 0 ? 365 / turnoverRatio : 999;

          let status: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
          if (turnoverRatio > 12) status = 'excellent'; // Less than 30 days
          else if (turnoverRatio > 6) status = 'good'; // 30-60 days
          else if (turnoverRatio > 3) status = 'fair'; // 60-120 days

          turnoverItems.push({
            product_id: productId,
            product_name: data.name,
            product_sku: data.sku,
            avg_inventory: currentQty,
            cogs: data.cogs,
            turnover_ratio: parseFloat(turnoverRatio.toFixed(2)),
            turnover_days: Math.round(turnoverDays),
            status,
          });
        }
      }

      // Sort by turnover ratio (highest first)
      return turnoverItems.sort((a, b) => b.turnover_ratio - a.turnover_ratio).slice(0, 10);
    },
    staleTime: 300000, // 5 minutes
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'default';
      case 'good': return 'secondary';
      case 'fair': return 'outline';
      case 'poor': return 'destructive';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fair':
      case 'poor':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Inventory Turnover
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

  if (!turnoverData || turnoverData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Inventory Turnover
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Insufficient data for turnover analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const avgTurnover = turnoverData.reduce((sum, item) => sum + item.turnover_ratio, 0) / turnoverData.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Inventory Turnover
          </CardTitle>
          <Badge variant="outline">
            Avg: {avgTurnover.toFixed(2)}x/year
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          How quickly inventory sells (higher is better)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {(expanded ? turnoverData : turnoverData.slice(0, 3)).map((item) => (
            <div
              key={item.product_id}
              className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(item.status)}
                  <span className="font-medium text-sm truncate">
                    {item.product_name}
                  </span>
                  <Badge variant={getStatusColor(item.status)} className="text-xs">
                    {item.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>SKU: {item.product_sku}</p>
                  <p className="font-medium text-foreground">
                    Turnover: {item.turnover_ratio}x/year • {item.turnover_days} days
                  </p>
                  <p>Current Stock: {item.avg_inventory} units</p>
                </div>
              </div>
            </div>
          ))}
          {turnoverData.length > 3 && (
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
                  Show All ({turnoverData.length} products)
                </>
              )}
            </Button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t">
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Excellent:</strong> &gt;12x/year (&lt;30 days)</p>
            <p><strong>Good:</strong> 6-12x/year (30-60 days)</p>
            <p><strong>Fair:</strong> 3-6x/year (60-120 days)</p>
            <p><strong>Poor:</strong> &lt;3x/year (&gt;120 days)</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
