import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, Package, Loader2 } from "lucide-react";
import { formatCurrency } from "@/utils/currency";
import { useCurrency } from "@/hooks/useCurrency";

export function InventoryValueWidget() {
  const { currency } = useCurrency();

  const { data: inventoryValue, isLoading } = useQuery({
    queryKey: ['inventory-value'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          quantity,
          product:products (
            cost,
            price
          )
        `);

      if (error) throw error;

      const totalCostValue = data.reduce((sum, item) => {
        const cost = item.product?.cost || 0;
        return sum + (item.quantity * cost);
      }, 0);

      const totalRetailValue = data.reduce((sum, item) => {
        const price = item.product?.price || 0;
        return sum + (item.quantity * price);
      }, 0);

      const potentialProfit = totalRetailValue - totalCostValue;
      const profitMargin = totalCostValue > 0 ? (potentialProfit / totalCostValue) * 100 : 0;

      return {
        costValue: totalCostValue,
        retailValue: totalRetailValue,
        potentialProfit,
        profitMargin,
        totalItems: data.length,
      };
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Inventory Value
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Inventory Value
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Cost Value</p>
              <p className="text-2xl font-bold">{formatCurrency(inventoryValue?.costValue || 0, currency)}</p>
            </div>
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Retail Value</p>
              <p className="text-2xl font-bold">{formatCurrency(inventoryValue?.retailValue || 0, currency)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg bg-accent/50">
            <div>
              <p className="text-sm text-muted-foreground">Potential Profit</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(inventoryValue?.potentialProfit || 0, currency)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">
                  {inventoryValue?.profitMargin.toFixed(1)}% margin
                </Badge>
              </div>
            </div>
            {(inventoryValue?.profitMargin || 0) > 0 ? (
              <TrendingUp className="h-8 w-8 text-green-500" />
            ) : (
              <TrendingDown className="h-8 w-8 text-red-500" />
            )}
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total SKUs in Stock</span>
              <span className="font-medium">{inventoryValue?.totalItems || 0}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
