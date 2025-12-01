import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function FixShopifyFulfilledOrders() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFix = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      toast.info("Starting fix for affected orders...");

      const { data, error } = await supabase.functions.invoke('fix-shopify-fulfilled-orders');

      if (error) throw error;

      setResult(data);
      
      if (data.ordersFixed > 0) {
        toast.success(`Successfully fixed ${data.ordersFixed} orders!`);
      } else {
        toast.info("No orders needed fixing");
      }
    } catch (error: any) {
      console.error('Error fixing orders:', error);
      toast.error(error.message || "Failed to fix orders");
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fix Shopify Fulfilled Orders</CardTitle>
        <CardDescription>
          Reset orders that were incorrectly marked as "delivered" due to Shopify fulfillment status.
          This will change them back to "pending" and add the "Shopify - Fulfilled" tag.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleFix} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Fixing Orders...
            </>
          ) : (
            "Fix Affected Orders"
          )}
        </Button>

        {result && (
          <Alert variant={result.error ? "destructive" : "default"}>
            {result.error ? (
              <>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Error:</strong> {result.error}
                </AlertDescription>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p><strong>Orders Fixed:</strong> {result.ordersFixed}</p>
                    <p><strong>Total Found:</strong> {result.totalFound}</p>
                    {result.errors && result.errors.length > 0 && (
                      <p className="text-destructive"><strong>Errors:</strong> {result.errors.length}</p>
                    )}
                  </div>
                </AlertDescription>
              </>
            )}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
