import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";

export function FullSyncControl() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-all');

      if (error) throw error;

      toast({
        title: "Full Sync Complete",
        description: `Synced ${data.stats?.products || 0} products, ${data.stats?.orders || 0} orders, ${data.stats?.customers || 0} customers`,
      });
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to complete full sync",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Full Sync
        </CardTitle>
        <CardDescription>
          Sync products, orders, and customers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSync} 
          disabled={syncing}
          className="w-full"
          variant="default"
        >
          {syncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
