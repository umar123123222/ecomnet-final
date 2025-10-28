import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { invokeSmartReorder } from "@/integrations/supabase/client";
import { Loader2, ShoppingCart, TrendingUp, AlertTriangle, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Recommendation {
  item_type: 'product' | 'packaging';
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
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeSmartReorder('get_recommendations', {});

      if (error) throw error;

      setRecommendations(data.recommendations || []);
    } catch (error: any) {
      console.error('Error fetching recommendations:', error);
      toast({
        title: "Failed to Load",
        description: error.message || "Could not load recommendations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const handleGeneratePO = async (rec: Recommendation) => {
    setGenerating(rec.item_id);
    try {
      const params = rec.item_type === 'product'
        ? { product_id: rec.item_id }
        : { packaging_item_id: rec.item_id };

      const { data, error } = await invokeSmartReorder('generate_po', params);

      if (error) throw error;

      toast({
        title: "PO Generated",
        description: `Purchase order ${data.po_number} created for ${rec.recommended_quantity} units.`,
      });

      // Refresh recommendations
      fetchRecommendations();
    } catch (error: any) {
      console.error('Error generating PO:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate purchase order",
        variant: "destructive",
      });
    } finally {
      setGenerating(null);
    }
  };

  const getUrgencyColor = (stockLevel: number, reorderPoint: number) => {
    const ratio = stockLevel / reorderPoint;
    if (ratio <= 0.25) return "destructive";
    if (ratio <= 0.5) return "warning";
    return "default";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Smart Reorder Recommendations
            </CardTitle>
            <CardDescription>
              Items that need reordering based on sales velocity and lead times
            </CardDescription>
          </div>
          <Button onClick={fetchRecommendations} variant="outline" size="sm">
            <TrendingUp className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recommendations.length === 0 ? (
          <div className="text-center py-8">
            <Package className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">All Stock Levels Adequate</h3>
            <p className="text-sm text-muted-foreground mt-2">
              No items currently need reordering
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Reorder Point</TableHead>
                  <TableHead className="text-right">Recommended Qty</TableHead>
                  <TableHead className="text-right">Daily Usage</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec) => {
                  const urgency = getUrgencyColor(rec.current_stock, rec.reorder_point);
                  
                  return (
                    <TableRow key={`${rec.item_type}-${rec.item_id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {rec.current_stock < rec.reorder_point * 0.5 && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                          <div>
                            <div className="font-medium">{rec.item_name}</div>
                            <div className="text-sm text-muted-foreground">{rec.item_sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {rec.item_type === 'product' ? 'Product' : 'Packaging'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={urgency}>
                          {rec.current_stock}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{rec.reorder_point}</TableCell>
                      <TableCell className="text-right font-medium">
                        {rec.recommended_quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        {rec.avg_daily_consumption.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {rec.supplier_name || (
                          <span className="text-muted-foreground">No supplier</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleGeneratePO(rec)}
                          disabled={!rec.supplier_id || generating === rec.item_id}
                        >
                          {generating === rec.item_id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="mr-2 h-4 w-4" />
                              Generate PO
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
