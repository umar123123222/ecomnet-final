import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Bell, FileText, Loader2 } from "lucide-react";
import { AssignedInventory } from "@/components/suppliers/AssignedInventory";
import { LowStockNotifications } from "@/components/suppliers/LowStockNotifications";
import { SupplierPurchaseOrders } from "@/components/suppliers/SupplierPurchaseOrders";
import { useAuth } from "@/contexts/AuthContext";

export default function SupplierPortal() {
  const { user } = useAuth();

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

      // Get low stock alerts count
      const { data: alerts, error: alertError } = await supabase
        .from("low_stock_notifications")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("response_received", false);

      if (alertError) throw alertError;

      // Get pending POs count
      const { data: pos, error: poError } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .in("status", ["draft", "pending"]);

      if (poError) throw poError;

      return {
        assignedItems: assignments?.length || 0,
        lowStockAlerts: alerts?.length || 0,
        pendingPOs: pos?.length || 0,
      };
    },
    enabled: !!supplierProfile?.supplier_id,
  });

  // Show loading state
  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show error if no supplier profile found
  if (!supplierProfile) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            No supplier profile found for your account. Please contact an administrator.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Supplier Portal</h1>
        <p className="text-muted-foreground">
          Welcome, {supplierProfile.supplier?.name}
        </p>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Assigned Items</p>
              <p className="text-2xl font-bold">{stats?.assignedItems || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
              <p className="text-2xl font-bold">{stats?.lowStockAlerts || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Pending POs</p>
              <p className="text-2xl font-bold">{stats?.pendingPOs || 0}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">
            <Package className="mr-2 h-4 w-4" />
            Inventory
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="orders">
            <FileText className="mr-2 h-4 w-4" />
            Purchase Orders
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <AssignedInventory supplierId={supplierProfile.supplier_id} />
        </TabsContent>

        <TabsContent value="notifications">
          <LowStockNotifications supplierId={supplierProfile.supplier_id} />
        </TabsContent>

        <TabsContent value="orders">
          <SupplierPurchaseOrders supplierId={supplierProfile.supplier_id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
