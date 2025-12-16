import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Star, TrendingUp, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { useCurrency } from "@/hooks/useCurrency";

interface ABCItem {
  product_id: string;
  product_name: string;
  product_sku: string;
  category: 'A' | 'B' | 'C';
  sales_value: number;
  percentage_of_total: number;
  cumulative_percentage: number;
}

export function ABCAnalysisWidget() {
  const { currency } = useCurrency();

  const { data: abcData, isLoading } = useQuery({
    queryKey: ['abc-analysis'],
    queryFn: async () => {
      // Get sales data from last 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: salesData, error } = await supabase
        .from('stock_movements')
        .select(`
          product_id,
          quantity,
          product:products!inner (
            id,
            name,
            sku,
            price
          )
        `)
        .eq('movement_type', 'sale')
        .gte('created_at', ninetyDaysAgo);

      if (error) throw error;

      // Calculate sales value per product
      const productSales: Record<string, { name: string; sku: string; value: number }> = {};

      salesData?.forEach((sale) => {
        const productId = sale.product_id;
        // Use absolute value since sale movements are stored as negative (deductions)
        const value = Math.abs(sale.quantity) * (sale.product?.price || 0);

        if (!productSales[productId]) {
          productSales[productId] = {
            name: sale.product?.name || 'Unknown',
            sku: sale.product?.sku || 'N/A',
            value: 0,
          };
        }
        productSales[productId].value += value;
      });

      // Sort by value and calculate percentages
      const sortedProducts = Object.entries(productSales)
        .map(([id, data]) => ({ product_id: id, ...data }))
        .sort((a, b) => b.value - a.value);

      const totalValue = sortedProducts.reduce((sum, p) => sum + p.value, 0);

      let cumulativePercentage = 0;
      const abcItems: ABCItem[] = sortedProducts.map((product) => {
        const percentage = totalValue > 0 ? (product.value / totalValue) * 100 : 0;
        cumulativePercentage += percentage;

        // ABC Classification
        let category: 'A' | 'B' | 'C' = 'C';
        if (cumulativePercentage <= 80) category = 'A'; // Top 80% of value
        else if (cumulativePercentage <= 95) category = 'B'; // Next 15% of value
        // Remaining 5% are C items

        return {
          product_id: product.product_id,
          product_name: product.name,
          product_sku: product.sku,
          category,
          sales_value: product.value,
          percentage_of_total: parseFloat(percentage.toFixed(2)),
          cumulative_percentage: parseFloat(cumulativePercentage.toFixed(2)),
        };
      });

      // Get counts per category
      const categoryA = abcItems.filter(i => i.category === 'A');
      const categoryB = abcItems.filter(i => i.category === 'B');
      const categoryC = abcItems.filter(i => i.category === 'C');

      const totalValueA = categoryA.reduce((sum, i) => sum + i.sales_value, 0);
      const totalValueB = categoryB.reduce((sum, i) => sum + i.sales_value, 0);
      const totalValueC = categoryC.reduce((sum, i) => sum + i.sales_value, 0);

      return {
        items: abcItems.slice(0, 15), // Top 15 items
        summary: {
          categoryA: { count: categoryA.length, value: totalValueA },
          categoryB: { count: categoryB.length, value: totalValueB },
          categoryC: { count: categoryC.length, value: totalValueC },
          total: totalValue,
        },
      };
    },
    staleTime: 300000, // 5 minutes
  });

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'A': return 'default';
      case 'B': return 'secondary';
      case 'C': return 'outline';
      default: return 'outline';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'A': return <Star className="h-4 w-4 text-yellow-500" />;
      case 'B': return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'C': return <Package className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ABC Analysis
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

  if (!abcData || abcData.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            ABC Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">Insufficient sales data for analysis</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          ABC Analysis
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Product value classification (90-day sales)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 border rounded-lg bg-accent/50">
              <div className="flex items-center gap-2 mb-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <Badge variant="default">Category A</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{abcData.summary.categoryA.count} products</p>
              <p className="text-sm font-medium">{formatCurrency(abcData.summary.categoryA.value, currency)}</p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <Badge variant="secondary">Category B</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{abcData.summary.categoryB.count} products</p>
              <p className="text-sm font-medium">{formatCurrency(abcData.summary.categoryB.value, currency)}</p>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Package className="h-4 w-4 text-gray-500" />
                <Badge variant="outline">Category C</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{abcData.summary.categoryC.count} products</p>
              <p className="text-sm font-medium">{formatCurrency(abcData.summary.categoryC.value, currency)}</p>
            </div>
          </div>

          {/* Product List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Performing Products</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {abcData.items.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getCategoryIcon(item.category)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">SKU: {item.product_sku}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={getCategoryColor(item.category)} className="mb-1">
                      {item.category}
                    </Badge>
                    <p className="text-xs font-medium">{formatCurrency(item.sales_value, currency)}</p>
                    <p className="text-xs text-muted-foreground">{item.percentage_of_total}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
