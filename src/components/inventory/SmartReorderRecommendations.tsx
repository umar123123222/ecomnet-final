import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Package, TrendingDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/currency";
import { useCurrency } from "@/hooks/useCurrency";

interface ReorderRecommendation {
  type: 'product' | 'packaging';
  item_id: string;
  item_name: string;
  item_sku: string;
  outlet_id?: string;
  current_stock: number;
  reorder_point: number;
  recommended_quantity: number;
  avg_daily_consumption: number;
  lead_time_days: number;
  safety_stock: number;
  supplier_id?: string;
  supplier_name?: string;
}

export function SmartReorderRecommendations() {
  const queryClient = useQueryClient();
  const { currency } = useCurrency();

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['smart-reorder-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('smart-reorder', {
        body: { action: 'get_recommendations' }
      });

      if (error) throw error;
      return data.recommendations as ReorderRecommendation[];
    },
    refetchInterval: 60000,
  });

  const createPOMutation = useMutation({
    mutationFn: async (recommendation: ReorderRecommendation) => {
      const { data, error } = await supabase.functions.invoke('smart-reorder', {
        body: { 
          action: 'generate_po',
          product_id: recommendation.type === 'product' ? recommendation.item_id : undefined,
          packaging_item_id: recommendation.type === 'packaging' ? recommendation.item_id : undefined
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Purchase order created successfully");
      queryClient.invalidateQueries({ queryKey: ['smart-reorder-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
    onError: (error) => {
      toast.error(`Failed to create purchase order: ${error.message}`);
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Smart Reorder Recommendations
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

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Smart Reorder Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">No reorder recommendations at this time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalEstimatedCost = recommendations.reduce((sum, rec) => sum + (rec.recommended_quantity * 10), 0); // Placeholder cost calculation

  const getPriority = (rec: ReorderRecommendation): 'critical' | 'high' | 'medium' => {
    const stockPercentage = (rec.current_stock / rec.reorder_point) * 100;
    if (stockPercentage <= 25) return 'critical';
    if (stockPercentage <= 50) return 'high';
    return 'medium';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Smart Reorder Recommendations
          </CardTitle>
          <Badge variant="outline">
            {recommendations.length} {recommendations.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Total estimated cost: {formatCurrency(totalEstimatedCost, currency)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec) => {
            const priority = getPriority(rec);
            return (
              <div
                key={`${rec.item_id}-${rec.outlet_id || 'global'}`}
                className="flex items-start justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={getPriorityColor(priority)}>
                      {priority}
                    </Badge>
                    <Badge variant="outline">{rec.type}</Badge>
                    <span className="font-medium text-sm truncate">
                      {rec.item_name}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>SKU: {rec.item_sku}{rec.supplier_name ? ` • Supplier: ${rec.supplier_name}` : ''}</p>
                    <p className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Current: {rec.current_stock} • Reorder Point: {rec.reorder_point}
                    </p>
                    <p className="font-medium text-foreground">
                      Recommended Quantity: {rec.recommended_quantity} • Avg Daily: {rec.avg_daily_consumption.toFixed(1)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => createPOMutation.mutate(rec)}
                  disabled={createPOMutation.isPending}
                >
                  {createPOMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Create PO"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
