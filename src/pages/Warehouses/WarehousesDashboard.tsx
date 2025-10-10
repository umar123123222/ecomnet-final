import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Warehouse, Plus, Edit, Trash2, Search, MapPin, Users, Package, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface WarehouseData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  manager_id: string | null;
  manager?: {
    full_name: string;
  };
  is_active: boolean;
  total_items?: number;
  created_at: string;
  updated_at: string;
}

const WarehousesDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    phone: "",
    manager_id: "",
    is_active: true,
  });

  // Fetch warehouses (outlets with type='warehouse')
  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select(`
          *,
          manager:profiles!outlets_manager_id_fkey(full_name)
        `)
        .eq("outlet_type", "warehouse")
        .order("name");
      if (error) throw error;
      return data as WarehouseData[];
    },
  });

  // Fetch inventory stats for warehouses
  const { data: inventoryStats = [] } = useQuery({
    queryKey: ["warehouse-inventory-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("outlet_id, quantity");
      if (error) throw error;
      
      const stats = data.reduce((acc, item) => {
        if (!acc[item.outlet_id]) {
          acc[item.outlet_id] = 0;
        }
        acc[item.outlet_id] += item.quantity;
        return acc;
      }, {} as Record<string, number>);
      
      return stats;
    },
  });

  // Fetch available managers
  const { data: managers = [] } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("role", ["super_admin", "super_manager", "warehouse_manager"])
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Create warehouse mutation
  const createWarehouseMutation = useMutation({
    mutationFn: async (data: { name: string; address: string; city: string; phone: string; manager_id: string; is_active: boolean }) => {
      const { error } = await supabase.from("outlets").insert({
        ...data,
        outlet_type: "warehouse",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast({
        title: "Warehouse Added",
        description: `Warehouse "${formData.name}" has been added successfully.`,
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update warehouse mutation
  const updateWarehouseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<WarehouseData> }) => {
      const { error } = await supabase.from("outlets").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast({
        title: "Warehouse Updated",
        description: `Warehouse "${formData.name}" has been updated successfully.`,
      });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete warehouse mutation
  const deleteWarehouseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outlets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast({
        title: "Warehouse Deleted",
        description: "Warehouse has been removed successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredWarehouses = warehouses.filter(
    (wh) =>
      wh.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wh.city?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (wh.manager?.full_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const totalStock = warehouses.reduce((sum, wh) => {
    const stock = inventoryStats[wh.id] || 0;
    return sum + stock;
  }, 0);

  const handleAddWarehouse = () => {
    setSelectedWarehouse(null);
    setFormData({
      name: "",
      address: "",
      city: "",
      phone: "",
      manager_id: "",
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEditWarehouse = (warehouse: WarehouseData) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      address: warehouse.address || "",
      city: warehouse.city || "",
      phone: warehouse.phone || "",
      manager_id: warehouse.manager_id || "",
      is_active: warehouse.is_active,
    });
    setDialogOpen(true);
  };

  const handleSaveWarehouse = () => {
    if (selectedWarehouse) {
      updateWarehouseMutation.mutate({
        id: selectedWarehouse.id,
        data: formData,
      });
    } else {
      createWarehouseMutation.mutate(formData);
    }
  };

  const handleDeleteWarehouse = (id: string) => {
    if (confirm("Are you sure you want to delete this warehouse?")) {
      deleteWarehouseMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Warehouse className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Warehouses</h1>
            <p className="text-muted-foreground">Manage warehouse facilities and operations</p>
          </div>
        </div>
        <Button onClick={handleAddWarehouse}>
          <Plus className="h-4 w-4 mr-2" />
          Add Warehouse
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Warehouses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warehouses.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Warehouses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {warehouses.filter(w => w.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalStock.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">units</p>
          </CardContent>
        </Card>
      </div>

      {/* Warehouses Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Warehouses ({filteredWarehouses.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search warehouses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Stock Items</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWarehouses.map((warehouse) => {
                const stockCount = inventoryStats[warehouse.id] || 0;
                return (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.address || "N/A"}</TableCell>
                    <TableCell>{warehouse.city || "N/A"}</TableCell>
                    <TableCell>{stockCount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">
                        {warehouse.manager?.full_name || "Not assigned"}
                      </div>
                    </TableCell>
                    <TableCell>{warehouse.phone || "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={warehouse.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {warehouse.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditWarehouse(warehouse)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteWarehouse(warehouse.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Warehouse Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedWarehouse ? "Edit Warehouse" : "Add New Warehouse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Warehouse Name</Label>
              <Input
                placeholder="e.g., Central Warehouse"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Address</Label>
              <Textarea
                placeholder="e.g., Industrial Area, Sector 12"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                placeholder="e.g., Lahore"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <Label>Manager</Label>
              <Select
                value={formData.manager_id}
                onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((manager) => (
                    <SelectItem key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input
                placeholder="e.g., +92-300-1234567"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={formData.is_active ? "active" : "inactive"}
                onValueChange={(v) => setFormData({ ...formData, is_active: v === "active" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveWarehouse}>
              {selectedWarehouse ? "Update" : "Add"} Warehouse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WarehousesDashboard;
