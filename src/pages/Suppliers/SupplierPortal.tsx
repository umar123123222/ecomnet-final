import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Package, Bell, FileText, BarChart3, Loader2, LogOut, Building2, AlertTriangle, Menu } from "lucide-react";
import { AssignedInventory } from "@/components/suppliers/AssignedInventory";
import { LowStockNotifications } from "@/components/suppliers/LowStockNotifications";
import { SupplierPurchaseOrders } from "@/components/suppliers/SupplierPurchaseOrders";
import { SupplierPerformance } from "@/components/suppliers/SupplierPerformance";
import { SupplierDiscrepancies } from "@/components/suppliers/SupplierDiscrepancies";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SupplierPortal() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("orders");

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

      const { data: assignments, error: assignError } = await supabase
        .from("supplier_products")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id);
      
      if (assignError) throw assignError;

      const { data: alerts, error: alertError } = await supabase
        .from("low_stock_notifications")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("response_received", false);

      if (alertError) throw alertError;

      const { data: pendingPOs, error: poError } = await supabase
        .from("purchase_orders")
        .select("id, supplier_confirmed")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("status", "pending")
        .is("supplier_confirmed", null);

      if (poError) throw poError;

      const { data: toShipPOs, error: shipError } = await supabase
        .from("purchase_orders")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("supplier_confirmed", true)
        .is("shipped_at", null)
        .neq("status", "cancelled");

      if (shipError) throw shipError;

      const { data: discrepancies, error: discError } = await supabase
        .from("goods_received_notes")
        .select("id")
        .eq("supplier_id", supplierProfile.supplier_id)
        .eq("discrepancy_flag", true);

      if (discError) throw discError;

      return {
        assignedItems: assignments?.length || 0,
        lowStockAlerts: alerts?.length || 0,
        pendingPOs: pendingPOs?.length || 0,
        toShipPOs: toShipPOs?.length || 0,
        discrepancies: discrepancies?.length || 0,
      };
    },
    enabled: !!supplierProfile?.supplier_id,
  });

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-muted-foreground font-medium">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (!supplierProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-muted/30 to-background p-4">
        <Card className="p-8 text-center max-w-md shadow-xl border-destructive/20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-destructive mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">
            No supplier profile found for your account. Please contact an administrator.
          </p>
          <Button variant="outline" onClick={() => signOut()} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </Card>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, color, onClick, active }: any) => (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all duration-200 text-left w-full ${
        active 
          ? 'bg-primary/10 border-primary shadow-md ring-2 ring-primary/20' 
          : 'bg-card hover:bg-muted/50 hover:shadow-md border-border'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className={`text-2xl font-bold ${active ? 'text-primary' : ''}`}>{value}</p>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-background">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 sm:p-2.5 bg-primary/10 rounded-xl shrink-0">
                <Building2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold truncate">Supplier Portal</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {supplierProfile.supplier?.name}
                </p>
              </div>
            </div>
            
            {/* Desktop sign out */}
            <Button 
              variant="outline" 
              onClick={() => signOut()}
              className="hidden sm:flex rounded-xl"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
            
            {/* Mobile menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild className="sm:hidden">
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Stats Grid - Horizontal scroll on mobile */}
        <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
          <ScrollArea className="w-full">
            <div className="flex gap-3 sm:grid sm:grid-cols-5 sm:gap-4 pb-2 sm:pb-0">
              <div className="shrink-0 w-[160px] sm:w-auto">
                <StatCard
                  icon={Package}
                  label="Assigned Items"
                  value={stats?.assignedItems || 0}
                  color="bg-primary/10 text-primary"
                  onClick={() => setActiveTab("inventory")}
                  active={activeTab === "inventory"}
                />
              </div>
              <div className="shrink-0 w-[160px] sm:w-auto">
                <StatCard
                  icon={Bell}
                  label="Pending Alerts"
                  value={stats?.lowStockAlerts || 0}
                  color="bg-amber-500/10 text-amber-600"
                  onClick={() => setActiveTab("notifications")}
                  active={activeTab === "notifications"}
                />
              </div>
              <div className="shrink-0 w-[160px] sm:w-auto">
                <StatCard
                  icon={FileText}
                  label="POs to Review"
                  value={stats?.pendingPOs || 0}
                  color="bg-orange-500/10 text-orange-600"
                  onClick={() => setActiveTab("orders")}
                  active={activeTab === "orders"}
                />
              </div>
              <div className="shrink-0 w-[160px] sm:w-auto">
                <StatCard
                  icon={Package}
                  label="Ready to Ship"
                  value={stats?.toShipPOs || 0}
                  color="bg-blue-500/10 text-blue-600"
                  onClick={() => setActiveTab("orders")}
                  active={false}
                />
              </div>
              <div className="shrink-0 w-[160px] sm:w-auto">
                <StatCard
                  icon={AlertTriangle}
                  label="Discrepancies"
                  value={stats?.discrepancies || 0}
                  color="bg-red-500/10 text-red-600"
                  onClick={() => setActiveTab("discrepancies")}
                  active={activeTab === "discrepancies"}
                />
              </div>
            </div>
            <ScrollBar orientation="horizontal" className="sm:hidden" />
          </ScrollArea>
        </div>

        {/* Main Content */}
        <Card className="bg-card/80 backdrop-blur-sm border shadow-sm overflow-hidden rounded-xl">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tab Navigation - Scrollable on mobile */}
            <div className="border-b bg-muted/30">
              <ScrollArea className="w-full">
                <TabsList className="inline-flex w-auto min-w-full h-auto p-1 bg-transparent gap-1">
                  <TabsTrigger 
                    value="orders" 
                    className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="hidden xs:inline">Purchase</span> Orders
                    {(stats?.pendingPOs || 0) > 0 && (
                      <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                        {stats?.pendingPOs}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="notifications"
                    className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                  >
                    <Bell className="h-4 w-4" />
                    <span className="hidden xs:inline">Stock</span> Alerts
                    {(stats?.lowStockAlerts || 0) > 0 && (
                      <span className="ml-1 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                        {stats?.lowStockAlerts}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="inventory"
                    className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                  >
                    <Package className="h-4 w-4" />
                    Inventory
                  </TabsTrigger>
                  <TabsTrigger 
                    value="discrepancies"
                    className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <span className="hidden xs:inline">Discrepancies</span>
                    <span className="xs:hidden">Issues</span>
                    {(stats?.discrepancies || 0) > 0 && (
                      <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                        {stats?.discrepancies}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="performance"
                    className="flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden xs:inline">Performance</span>
                    <span className="xs:hidden">Stats</span>
                  </TabsTrigger>
                </TabsList>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>

            <div className="p-4 sm:p-6">
              <TabsContent value="orders" className="m-0">
                <SupplierPurchaseOrders supplierId={supplierProfile.supplier_id} />
              </TabsContent>

              <TabsContent value="notifications" className="m-0">
                <LowStockNotifications supplierId={supplierProfile.supplier_id} />
              </TabsContent>

              <TabsContent value="inventory" className="m-0">
                <AssignedInventory supplierId={supplierProfile.supplier_id} />
              </TabsContent>

              <TabsContent value="discrepancies" className="m-0">
                <SupplierDiscrepancies supplierId={supplierProfile.supplier_id} />
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
