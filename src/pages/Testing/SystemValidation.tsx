import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, XCircle, AlertTriangle, PlayCircle, 
  Database, ShoppingCart, Package, TrendingUp, Loader2 
} from "lucide-react";

interface ValidationResult {
  test: string;
  status: "pass" | "fail" | "warning";
  message: string;
  details?: any;
}

export default function SystemValidation() {
  const { toast } = useToast();
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runValidation = async () => {
    setIsRunning(true);
    setResults([]);
    const validationResults: ValidationResult[] = [];

    try {
      // Test 1: Check for orphaned inventory records
      const { data: orphanedInventory, error: invError } = await supabase
        .from("inventory")
        .select("id, product_id, outlet_id")
        .is("product_id", null);
      
      validationResults.push({
        test: "Orphaned Inventory Records",
        status: orphanedInventory && orphanedInventory.length > 0 ? "fail" : "pass",
        message: orphanedInventory?.length 
          ? `Found ${orphanedInventory.length} inventory records without products` 
          : "No orphaned inventory records",
        details: orphanedInventory
      });

      // Test 2: Check for negative inventory
      const { data: negativeInventory } = await supabase
        .from("inventory")
        .select("id, product_id, quantity, outlet_id, products(name)")
        .lt("quantity", 0);
      
      validationResults.push({
        test: "Negative Inventory",
        status: negativeInventory && negativeInventory.length > 0 ? "warning" : "pass",
        message: negativeInventory?.length 
          ? `Found ${negativeInventory.length} products with negative inventory` 
          : "No negative inventory",
        details: negativeInventory
      });

      // Test 3: Check reserved quantity exceeds total  
      const { data: allInventory } = await supabase
        .from("inventory")
        .select("id, product_id, quantity, reserved_quantity, products(name)");
      
      const invalidReserved = allInventory?.filter(item => 
        item.reserved_quantity > item.quantity
      );
      
      validationResults.push({
        test: "Invalid Reserved Quantity",
        status: invalidReserved && invalidReserved.length > 0 ? "fail" : "pass",
        message: invalidReserved?.length 
          ? `Found ${invalidReserved.length} records where reserved > total` 
          : "All reserved quantities valid",
        details: invalidReserved
      });

      // Test 4: Check for orders without customers
      const { data: ordersWithoutCustomers } = await supabase
        .from("orders")
        .select("id, order_number, customer_id")
        .is("customer_id", null);
      
      validationResults.push({
        test: "Orders Without Customers",
        status: ordersWithoutCustomers && ordersWithoutCustomers.length > 0 ? "warning" : "pass",
        message: ordersWithoutCustomers?.length 
          ? `Found ${ordersWithoutCustomers.length} orders without customer links` 
          : "All orders have customers",
        details: ordersWithoutCustomers
      });

      // Test 5: Check dispatches without orders
      const { data: orphanedDispatches } = await supabase
        .from("dispatches")
        .select("id, order_id, tracking_id")
        .is("order_id", null);
      
      validationResults.push({
        test: "Orphaned Dispatches",
        status: orphanedDispatches && orphanedDispatches.length > 0 ? "fail" : "pass",
        message: orphanedDispatches?.length 
          ? `Found ${orphanedDispatches.length} dispatches without orders` 
          : "All dispatches linked to orders",
        details: orphanedDispatches
      });

      // Test 6: Check for stuck orders (pending > 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: stuckOrders } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at")
        .eq("status", "pending")
        .lt("created_at", sevenDaysAgo.toISOString());
      
      validationResults.push({
        test: "Stuck Orders",
        status: stuckOrders && stuckOrders.length > 0 ? "warning" : "pass",
        message: stuckOrders?.length 
          ? `Found ${stuckOrders.length} orders pending for >7 days` 
          : "No stuck orders",
        details: stuckOrders
      });

      // Test 7: Check sync queue health
      const { data: failedSyncs } = await supabase
        .from("sync_queue")
        .select("id, entity_type, action, status, error_message")
        .eq("status", "failed");
      
      validationResults.push({
        test: "Sync Queue Health",
        status: failedSyncs && failedSyncs.length > 10 ? "warning" : "pass",
        message: failedSyncs?.length 
          ? `Found ${failedSyncs.length} failed sync operations` 
          : "Sync queue healthy",
        details: failedSyncs
      });

      // Test 8: Check for unresolved automated alerts
      const { data: unresolvedAlerts } = await supabase
        .from("automated_alerts")
        .select("id, alert_type, severity, created_at")
        .eq("status", "active")
        .eq("severity", "critical");
      
      validationResults.push({
        test: "Critical Alerts",
        status: unresolvedAlerts && unresolvedAlerts.length > 0 ? "fail" : "pass",
        message: unresolvedAlerts?.length 
          ? `Found ${unresolvedAlerts.length} unresolved critical alerts` 
          : "No critical alerts",
        details: unresolvedAlerts
      });

      setResults(validationResults);
      
      const failCount = validationResults.filter(r => r.status === "fail").length;
      const warnCount = validationResults.filter(r => r.status === "warning").length;
      
      toast({
        title: "Validation Complete",
        description: `${failCount} failures, ${warnCount} warnings`,
        variant: failCount > 0 ? "destructive" : "default"
      });

    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "fail":
        return <XCircle className="h-5 w-5 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  const passCount = results.filter(r => r.status === "pass").length;
  const failCount = results.filter(r => r.status === "fail").length;
  const warnCount = results.filter(r => r.status === "warning").length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-6 w-6" />
                System Validation & Testing
              </CardTitle>
              <CardDescription>
                Automated tests to validate data integrity and system health
              </CardDescription>
            </div>
            <Button onClick={runValidation} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" />
                  Run Validation
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {results.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <div>
                      <p className="text-2xl font-bold">{passCount}</p>
                      <p className="text-sm text-muted-foreground">Passed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    <div>
                      <p className="text-2xl font-bold">{warnCount}</p>
                      <p className="text-sm text-muted-foreground">Warnings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-8 w-8 text-destructive" />
                    <div>
                      <p className="text-2xl font-bold">{failCount}</p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Test Results</h3>
              {results.map((result, index) => (
                <Alert key={index} variant={result.status === "fail" ? "destructive" : "default"}>
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <AlertTitle>{result.test}</AlertTitle>
                      <AlertDescription>{result.message}</AlertDescription>
                      {result.details && result.details.length > 0 && (
                        <details className="mt-2 cursor-pointer">
                          <summary className="text-sm font-medium">View Details</summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <Badge variant={
                      result.status === "pass" ? "default" : 
                      result.status === "fail" ? "destructive" : "secondary"
                    }>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                </Alert>
              ))}
            </div>
          )}

          {results.length === 0 && !isRunning && (
            <div className="text-center py-12 text-muted-foreground">
              Click "Run Validation" to start testing system health
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
