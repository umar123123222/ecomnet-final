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
  const [batchSize, setBatchSize] = useState(50);

  const handleVerify = async () => {
    try {
      setLoading(true);
      setResult(null);
      
      toast.info(`Processing batch of up to ${batchSize} orders...`);

      const { data, error } = await supabase.functions.invoke('verify-delivered-orders', {
        body: { batchSize }
      });

      if (error) throw error;

      setResult(data);
      
      if (data.downgraded > 0) {
        toast.success(`Fixed ${data.downgraded} incorrectly marked orders!`);
      } else if (data.verified > 0) {
        toast.success(`Processed ${data.processed} orders - all verified correct!`);
      } else {
        toast.info("No more delivered orders to verify");
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
          Re-check orders marked as "delivered" against courier APIs in batches. Any orders that aren't actually delivered will be automatically downgraded to the correct status. Run multiple times to process all orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Batch Size (max 100)</label>
          <input 
            type="number" 
            min="1" 
            max="100" 
            value={batchSize}
            onChange={(e) => setBatchSize(Math.min(100, Math.max(1, parseInt(e.target.value) || 50)))}
            className="w-full px-3 py-2 border rounded-md"
            disabled={loading}
          />
        </div>

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
              Verify Batch
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
                    <div className="grid grid-cols-2 gap-4 text-sm mb-2">
                      <div>
                        <strong>Processed:</strong> {result.processed}/{result.batchSize}
                      </div>
                      <div className={result.hasMore ? "text-blue-600 font-semibold" : ""}>
                        {result.hasMore ? "✓ More orders available" : "✓ All orders checked"}
                      </div>
                    </div>
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
