import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Warehouse, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function OutletStockWidget() {
  const [expanded, setExpanded] = useState(false);
  
  const { data: outletSummary, isLoading } = useQuery({
    queryKey: ['outlet-stock-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_stock_summary')
        .select('*')
        .order('total_value', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Outlet Stock Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const allOutlets = outletSummary || [];
  const displayedOutlets = expanded ? allOutlets : allOutlets.slice(0, 3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Outlet Stock Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {displayedOutlets.map((outlet) => (
            <div key={outlet.outlet_id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {outlet.outlet_type === 'warehouse' ? (
                    <Warehouse className="h-4 w-4" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  <p className="font-medium">{outlet.outlet_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={outlet.outlet_type === 'warehouse' ? 'default' : 'secondary'}>
                    {outlet.outlet_type}
                  </Badge>
                  <Badge variant="outline">{outlet.product_count} products</Badge>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{outlet.total_units}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Reserved</p>
                  <p className="font-medium text-orange-600">{outlet.reserved_units}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="font-medium text-green-600">{outlet.available_units}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t">
                <p className="text-xs text-muted-foreground">Stock Value</p>
                <p className="font-semibold">Rs {outlet.total_value?.toFixed(0) || 0}</p>
              </div>
            </div>
          ))}
        </div>

        {allOutlets.length > 3 && (
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
                Show All ({allOutlets.length} outlets)
              </>
            )}
          </Button>
        )}

        {allOutlets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No outlets with inventory found
          </p>
        )}
      </CardContent>
    </Card>
  );
}
