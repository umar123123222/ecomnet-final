import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";
interface HealthMetrics {
  overallScore: number;
  stockAvailability: number;
  turnoverRate: number;
  accuracyScore: number;
  fulfillmentCapacity: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  strengths: string[];
}
export function InventoryHealthScore() {
  const {
    data: healthMetrics,
    isLoading
  } = useQuery({
    queryKey: ['inventory-health'],
    queryFn: async () => {
      const issues: string[] = [];
      const strengths: string[] = [];
      let totalScore = 0;

      // 1. Stock Availability Score (25 points)
      const {
        data: inventory
      } = await supabase.from('inventory').select(`
          quantity,
          product:products!inner (
            reorder_level
          )
        `);
      const totalProducts = inventory?.length || 0;
      const inStockProducts = inventory?.filter(inv => inv.quantity > 0).length || 0;
      const lowStockProducts = inventory?.filter(inv => inv.quantity > 0 && inv.quantity <= (inv.product?.reorder_level || 0)).length || 0;
      const outOfStockProducts = totalProducts - inStockProducts;
      const stockAvailability = totalProducts > 0 ? (inStockProducts - lowStockProducts * 0.5) / totalProducts * 100 : 0;
      const stockScore = Math.min(stockAvailability / 100 * 25, 25);
      totalScore += stockScore;
      if (outOfStockProducts > totalProducts * 0.1) {
        issues.push(`${outOfStockProducts} products out of stock (${(outOfStockProducts / totalProducts * 100).toFixed(1)}%)`);
      } else if (outOfStockProducts === 0) {
        strengths.push('No out-of-stock items');
      }
      if (lowStockProducts > totalProducts * 0.2) {
        issues.push(`${lowStockProducts} products at low stock levels`);
      }

      // 2. Turnover Rate Score (25 points)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const {
        data: sales
      } = await supabase.from('stock_movements').select('quantity').eq('movement_type', 'sale').gte('created_at', thirtyDaysAgo);
      const totalSales = sales?.reduce((sum, s) => sum + s.quantity, 0) || 0;
      const totalStock = inventory?.reduce((sum, inv) => sum + inv.quantity, 0) || 0;
      const turnoverRate = totalStock > 0 ? totalSales / totalStock * 100 : 0;
      const turnoverScore = Math.min(turnoverRate / 100 * 25, 25);
      totalScore += turnoverScore;
      if (turnoverRate < 20) {
        issues.push('Low inventory turnover rate (slow-moving stock)');
      } else if (turnoverRate > 80) {
        strengths.push('Excellent inventory turnover');
      }

      // 3. Accuracy Score (25 points) - based on variance history
      const {
        data: variances
      } = await supabase.from('count_variances').select('variance_value, status').gte('created_at', thirtyDaysAgo);
      const openVariances = variances?.filter(v => v.status === 'open').length || 0;
      const totalVariances = variances?.length || 0;
      const accuracyScore = totalVariances > 0 ? (totalVariances - openVariances) / totalVariances * 25 : 25;
      totalScore += accuracyScore;
      if (openVariances > 5) {
        issues.push(`${openVariances} unresolved count variances`);
      } else if (openVariances === 0) {
        strengths.push('All variances resolved');
      }

      // 4. Fulfillment Capacity Score (25 points)
      const availableStock = inventory?.reduce((sum, inv) => sum + (inv.quantity - (inv.product?.reorder_level || 0)), 0) || 0;
      const fulfillmentCapacity = totalStock > 0 ? Math.max(availableStock / totalStock * 100, 0) : 0;
      const fulfillmentScore = Math.min(fulfillmentCapacity / 100 * 25, 25);
      totalScore += fulfillmentScore;
      if (fulfillmentCapacity < 30) {
        issues.push('Low fulfillment capacity - consider reordering');
      } else if (fulfillmentCapacity > 70) {
        strengths.push('Strong fulfillment capacity');
      }

      // Overall status
      let status: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (totalScore >= 85) status = 'excellent';else if (totalScore >= 70) status = 'good';else if (totalScore >= 50) status = 'fair';
      const metrics: HealthMetrics = {
        overallScore: Math.round(totalScore),
        stockAvailability: Math.round(stockAvailability),
        turnoverRate: Math.round(turnoverRate),
        accuracyScore: Math.round(accuracyScore),
        fulfillmentCapacity: Math.round(fulfillmentCapacity),
        status,
        issues,
        strengths
      };
      return metrics;
    },
    staleTime: 300000 // 5 minutes
  });
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'default';
      case 'good':
        return 'secondary';
      case 'fair':
        return 'outline';
      case 'poor':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'excellent':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'good':
        return <Activity className="h-6 w-6 text-blue-500" />;
      case 'fair':
        return <AlertTriangle className="h-6 w-6 text-orange-500" />;
      case 'poor':
        return <XCircle className="h-6 w-6 text-red-500" />;
      default:
        return null;
    }
  };
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };
  if (isLoading) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Inventory Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>;
  }
  if (!healthMetrics) {
    return null;
  }
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Inventory Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Overall Score */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-orange-100">
            <div className="flex items-center gap-3">
              {getStatusIcon(healthMetrics.status)}
              <div>
                <p className="text-sm text-muted-foreground">Overall Health</p>
                <Badge variant={getStatusColor(healthMetrics.status)} className="mt-1">
                  {healthMetrics.status.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-4xl font-bold ${getScoreColor(healthMetrics.overallScore)}`}>
                {healthMetrics.overallScore}
              </p>
              <p className="text-xs text-muted-foreground">out of 100</p>
            </div>
          </div>

          {/* Metric Breakdown */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Stock Availability</span>
                <span className="text-sm text-muted-foreground">{healthMetrics.stockAvailability}%</span>
              </div>
              <Progress value={healthMetrics.stockAvailability} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Turnover Rate</span>
                <span className="text-sm text-muted-foreground">{healthMetrics.turnoverRate}%</span>
              </div>
              <Progress value={healthMetrics.turnoverRate} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Accuracy Score</span>
                <span className="text-sm text-muted-foreground">{healthMetrics.accuracyScore}%</span>
              </div>
              <Progress value={healthMetrics.accuracyScore} className="h-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Fulfillment Capacity</span>
                <span className="text-sm text-muted-foreground">{healthMetrics.fulfillmentCapacity}%</span>
              </div>
              <Progress value={healthMetrics.fulfillmentCapacity} className="h-2" />
            </div>
          </div>

          {/* Issues & Strengths */}
          {healthMetrics.issues.length > 0 && <div className="space-y-2">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Areas for Improvement:</p>
              <ul className="space-y-1">
                {healthMetrics.issues.map((issue, index) => <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                    {issue}
                  </li>)}
              </ul>
            </div>}

          {healthMetrics.strengths.length > 0 && <div className="space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Strengths:</p>
              <ul className="space-y-1">
                {healthMetrics.strengths.map((strength, index) => <li key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    {strength}
                  </li>)}
              </ul>
            </div>}
        </div>
      </CardContent>
    </Card>;
}