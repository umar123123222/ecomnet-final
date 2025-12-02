import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Plus, Loader2, Users, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Outlet, Inventory } from "@/types/inventory";
import { AddOutletDialog } from "@/components/inventory/AddOutletDialog";
import { useUserRoles } from "@/hooks/useUserRoles";
import { getRolePermissions } from "@/utils/rolePermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const OutletManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [outletDialogOpen, setOutletDialogOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [outletToDelete, setOutletToDelete] = useState<Outlet | null>(null);
  const { primaryRole } = useUserRoles();
  const permissions = getRolePermissions(primaryRole);

  // Delete outlet mutation
  const deleteOutletMutation = useMutation({
    mutationFn: async (outletId: string) => {
      // Check for related records
      const [purchaseOrders, inventory, stockTransfers] = await Promise.all([
        supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("outlet_id", outletId),
        supabase.from("inventory").select("id", { count: "exact", head: true }).eq("outlet_id", outletId),
        supabase.from("stock_transfer_requests").select("id", { count: "exact", head: true }).or(`from_outlet_id.eq.${outletId},to_outlet_id.eq.${outletId}`)
      ]);

      const relatedRecords = [];
      if (purchaseOrders.count && purchaseOrders.count > 0) relatedRecords.push(`${purchaseOrders.count} purchase order(s)`);
      if (inventory.count && inventory.count > 0) relatedRecords.push(`${inventory.count} inventory record(s)`);
      if (stockTransfers.count && stockTransfers.count > 0) relatedRecords.push(`${stockTransfers.count} stock transfer(s)`);

      if (relatedRecords.length > 0) {
        throw new Error(`Cannot delete outlet. It has ${relatedRecords.join(", ")} associated with it. Please remove or reassign these records first.`);
      }

      const { error } = await supabase
        .from("outlets")
        .delete()
        .eq("id", outletId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Outlet deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["outlets"] });
      queryClient.invalidateQueries({ queryKey: ["outlet-stats"] });
      setDeleteDialogOpen(false);
      setOutletToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete outlet",
        variant: "destructive",
      });
    },
  });

  // Fetch outlets
  const { data: outlets, isLoading } = useQuery<(Outlet & { manager?: { full_name: string } })[]>({
    queryKey: ["outlets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select(`
          *,
          manager:profiles(full_name)
        `)
        .order("name");
      if (error) throw error;
      return data as (Outlet & { manager?: { full_name: string } })[];
    },
  });

  // Fetch inventory stats for each outlet
  const { data: outletStats } = useQuery<Record<string, { totalItems: number; availableItems: number }>>({
    queryKey: ["outlet-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("outlet_id, quantity, available_quantity");
      
      if (error) throw error;

      const stats = data.reduce((acc, item) => {
        if (!acc[item.outlet_id]) {
          acc[item.outlet_id] = { totalItems: 0, availableItems: 0 };
        }
        acc[item.outlet_id].totalItems += item.quantity;
        acc[item.outlet_id].availableItems += item.available_quantity;
        return acc;
      }, {} as Record<string, { totalItems: number; availableItems: number }>);

      return stats;
    },
  });

  const warehouses = outlets?.filter(o => o.outlet_type === 'warehouse') || [];
  const retailOutlets = outlets?.filter(o => o.outlet_type === 'retail') || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Outlets/Warehouses
          </h1>
          <p className="text-muted-foreground">Manage warehouses and retail outlets</p>
        </div>
        {permissions.canManageOutlets && (
          <Button
            onClick={() => {
              setSelectedOutlet(null);
              setOutletDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Outlet/Warehouse
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <>
          {/* Warehouses Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <h2 className="text-xl font-semibold">Warehouses</h2>
              <Badge variant="secondary">{warehouses.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {warehouses.map((outlet) => {
                const stats = outletStats?.[outlet.id] || { totalItems: 0, availableItems: 0 };
                return (
                  <Card key={outlet.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{outlet.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {outlet.city}
                          </CardDescription>
                        </div>
                        <Badge className="bg-purple-500">Warehouse</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Inventory</span>
                        <span className="font-semibold">{stats.totalItems}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Available</span>
                        <span className="font-semibold text-green-600">{stats.availableItems}</span>
                      </div>
                      {outlet.manager && 'full_name' in outlet.manager && (
                        <div className="flex items-center gap-2 text-sm pt-2 border-t">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Manager:</span>
                          <span className="font-medium">{outlet.manager.full_name}</span>
                        </div>
                      )}
                      {outlet.phone && (
                        <div className="text-sm text-muted-foreground">
                          {outlet.phone}
                        </div>
                      )}
                      {permissions.canManageOutlets && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedOutlet(outlet);
                              setOutletDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setOutletToDelete(outlet);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Retail Outlets Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-500" />
              <h2 className="text-xl font-semibold">Retail Outlets</h2>
              <Badge variant="secondary">{retailOutlets.length}</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {retailOutlets.map((outlet) => {
                const stats = outletStats?.[outlet.id] || { totalItems: 0, availableItems: 0 };
                return (
                  <Card key={outlet.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{outlet.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3" />
                            {outlet.city}
                          </CardDescription>
                        </div>
                        <Badge className="bg-blue-500">Outlet</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total Inventory</span>
                        <span className="font-semibold">{stats.totalItems}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Available</span>
                        <span className="font-semibold text-green-600">{stats.availableItems}</span>
                      </div>
                      {outlet.manager && 'full_name' in outlet.manager && (
                        <div className="flex items-center gap-2 text-sm pt-2 border-t">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Manager:</span>
                          <span className="font-medium">{outlet.manager.full_name}</span>
                        </div>
                      )}
                      {outlet.phone && (
                        <div className="text-sm text-muted-foreground">
                          {outlet.phone}
                        </div>
                      )}
                      {permissions.canManageOutlets && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                              setSelectedOutlet(outlet);
                              setOutletDialogOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setOutletToDelete(outlet);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <AddOutletDialog
        open={outletDialogOpen}
        onOpenChange={(open) => {
          setOutletDialogOpen(open);
          if (!open) setSelectedOutlet(null);
        }}
        outlet={selectedOutlet}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outlet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{outletToDelete?.name}"? This action cannot be undone.
              All inventory and associated data will remain but will no longer be linked to this outlet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setOutletToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => outletToDelete && deleteOutletMutation.mutate(outletToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteOutletMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OutletManagement;
