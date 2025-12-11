import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Package, Bell, FileText, BarChart3, Loader2, LogOut, Building2 } from "lucide-react";
import { AssignedInventory } from "@/components/suppliers/AssignedInventory";
import { LowStockNotifications } from "@/components/suppliers/LowStockNotifications";
import { SupplierPurchaseOrders } from "@/components/suppliers/SupplierPurchaseOrders";
import { SupplierPerformance } from "@/components/suppliers/SupplierPerformance";
import { useAuth } from "@/contexts/AuthContext";

export default function SupplierPortal() {
  const { user, signOut } = useAuth();

  const { data: supplierProfile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["supplier-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("supplier_profiles")
        .select("*, supplier:suppliers(*)")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["supplier-stats", supplierProfile?.supplier_id],
    queryFn: async () => {
      if (!supplierProfile?.supplier_id) return null;

      // Get assigned items count
      const { data: assignments, error: assignError } = await supabase
        .from("supplier_products")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id);
      
      if (assignError) throw assignError;

      // Get pending low stock alerts count
      const { data: alerts, error: alertError } = await supabase
        .from("low_stock_notifications")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("response_received", false);

      if (alertError) throw alertError;

      // Get pending POs count (awaiting confirmation)
      const { data: pendingPOs, error: poError } = await supabase
        .from("purchase_orders")
        .select("id, supplier_confirmed")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("status", "pending")
        .is("supplier_confirmed", null);

      if (poError) throw poError;

      // Get confirmed but not shipped POs
      const { data: toShipPOs, error: shipError } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("supplier_confirmed", true)
        .is("shipped_at", null)
        .neq("status", "cancelled");

      if (shipError) throw shipError;

      return {
        assignedItems: assignments?.length || 0,
        lowStockAlerts: alerts?.length || 0,
        pendingPOs: pendingPOs?.length || 0,
        toShipPOs: toShipPOs?.length || 0,
      };
    },
    enabled: !!supplierProfile?.supplier_id,
  });

  // Show loading state
  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading portal...</p>
        </div>
      </div>
    );
  }

  // Show error if no supplier profile found
  if (!supplierProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-4">
            No supplier profile found for your account. Please contact an administrator.
          </p>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Supplier Portal</h1>
              <p className="text-sm text-muted-foreground">{supplierProfile.supplier?.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assigned Items</p>
                <p className="text-3xl font-bold">{stats?.assignedItems || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Bell className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Alerts</p>
                <p className="text-3xl font-bold text-yellow-600">{stats?.lowStockAlerts || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">POs to Review</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.pendingPOs || 0}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ready to Ship</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.toShipPOs || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Card className="bg-background/80 backdrop-blur-sm">
          <Tabs defaultValue="orders" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
              <TabsTrigger 
                value="orders" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4"
              >
                <FileText className="mr-2 h-4 w-4" />
                Purchase Orders
                {(stats?.pendingPOs || 0) > 0 && (
                  <span className="ml-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {stats?.pendingPOs}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="notifications"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4"
              >
                <Bell className="mr-2 h-4 w-4" />
                Stock Alerts
                {(stats?.lowStockAlerts || 0) > 0 && (
                  <span className="ml-2 bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {stats?.lowStockAlerts}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="inventory"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4"
              >
                <Package className="mr-2 h-4 w-4" />
                Inventory
              </TabsTrigger>
              <TabsTrigger 
                value="performance"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-6 py-4"
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                Performance
              </TabsTrigger>
            </TabsList>

            <div className="p-6">
              <TabsContent value="orders" className="m-0">
                <SupplierPurchaseOrders supplierId={supplierProfile.supplier_id} />
              </TabsContent>

              <TabsContent value="notifications" className="m-0">
                <LowStockNotifications supplierId={supplierProfile.supplier_id} />
              </TabsContent>

              <TabsContent value="inventory" className="m-0">
                <AssignedInventory supplierId={supplierProfile.supplier_id} />
              </TabsContent>

              <TabsContent value="performance" className="m-0">
                <SupplierPerformance supplierId={supplierProfile.supplier_id} />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}