import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, RefreshCw } from "lucide-react";

export function ProductSyncControl() {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-shopify-products');

      if (error) throw error;

      toast({
        title: "Products Synced",
        description: data.message || `Successfully synced ${data.synced} products`,
      });
    } catch (error: any) {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync products",
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
          <Package className="h-5 w-5" />
          Product Sync
        </CardTitle>
        <CardDescription>
          Sync product catalog from Shopify
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={handleSync} 
          disabled={syncing}
          className="w-full"
        >
          {syncing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <Package className="mr-2 h-4 w-4" />
              Sync Products
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
