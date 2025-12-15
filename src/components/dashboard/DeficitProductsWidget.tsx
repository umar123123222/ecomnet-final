import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertOctagon, TrendingDown, Loader2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DeficitProduct {
  id: string;
  quantity: number;
  available_quantity: number;
  product: {
    id: string;
    name: string;
    sku: string;
  } | null;
  outlet: {
    id: string;
    name: string;
  } | null;
}

export function DeficitProductsWidget() {
  const navigate = useNavigate();
  
  const { data: deficitProducts, isLoading } = useQuery<DeficitProduct[]>({
    queryKey: ["deficit-products-widget"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select(`
          id,
          quantity,
          available_quantity,
          product:products(id, name, sku),
          outlet:outlets(id, name)
        `)
        .lt("quantity", 0)
        .order("quantity", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data as DeficitProduct[];
    },
    refetchInterval: 120000,
  });

  if (isLoading) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-destructive" />
            Deficit Products
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-destructive" />
        </CardContent>
      </Card>
    );
  }

  const deficitCount = deficitProducts?.length || 0;

  return (
    <Card className={deficitCount > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className={`h-5 w-5 text-destructive ${deficitCount > 0 ? 'animate-pulse' : ''}`} />
              Deficit Products
            </CardTitle>
            <CardDescription>Products with negative inventory (oversold)</CardDescription>
          </div>
          {deficitCount > 0 && (
            <Badge variant="destructive" className="text-lg px-3 py-1">
              {deficitCount}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {deficitCount === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <AlertOctagon className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No deficit products</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deficitProducts?.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/10 hover:bg-destructive/15 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.product?.name || 'Unknown Product'}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.outlet?.name} • SKU: {item.product?.sku || 'N/A'}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-destructive font-bold">
                      <TrendingDown className="h-3 w-3" />
                      {item.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Deficit
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-2"
              onClick={() => navigate('/inventory')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View All Inventory
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
