import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export function VerifyDeliveredOrders() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleVerify = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      toast.info("Verifying all delivered orders with courier APIs...");

      const { data, error } = await supabase.functions.invoke('verify-delivered-orders');

      if (error) throw error;

      setResult(data);
      
      if (data.downgraded > 0) {
        toast.success(`Fixed ${data.downgraded} incorrectly marked orders!`);
      } else if (data.verified > 0) {
        toast.success(`All ${data.verified} delivered orders verified as correct!`);
      } else {
        toast.info("No delivered orders found to verify");
      }
    } catch (error: any) {
      console.error('Error verifying orders:', error);
      toast.error(error.message || "Failed to verify orders");
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Verify Delivered Orders</CardTitle>
        </div>
        <CardDescription>
          Re-check all orders marked as "delivered" against courier APIs. Any orders that aren't actually delivered will be automatically downgraded to the correct status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={handleVerify} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying Orders...
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Verify All Delivered Orders
            </>
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
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <strong>Verified:</strong> {result.verified}
                      </div>
                      <div className={result.downgraded > 0 ? "text-orange-600 font-semibold" : ""}>
                        <strong>Fixed:</strong> {result.downgraded}
                      </div>
                      <div className={result.errors > 0 ? "text-destructive" : ""}>
                        <strong>Errors:</strong> {result.errors}
                      </div>
                    </div>
                    
                    {result.downgradedOrders && result.downgradedOrders.length > 0 && (
                      <div className="mt-3 p-2 bg-muted rounded-md text-xs space-y-1">
                        <p className="font-semibold">Fixed Orders:</p>
                        {result.downgradedOrders.slice(0, 10).map((order: any) => (
                          <p key={order.order_number}>
                            {order.order_number} - {order.courier}: "{order.courier_status}" → {order.new_status}
                          </p>
                        ))}
                        {result.downgradedOrders.length > 10 && (
                          <p className="text-muted-foreground">
                            ...and {result.downgradedOrders.length - 10} more
                          </p>
                        )}
                      </div>
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
