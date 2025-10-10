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
import { Warehouse, Plus, Edit, Trash2, Search, MapPin, Users, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WarehouseData {
  id: string;
  name: string;
  location: string;
  city: string;
  capacity: number;
  current_stock: number;
  manager_name: string;
  contact_phone: string;
  status: "active" | "inactive" | "maintenance";
  created_at: string;
}

const WarehousesDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    city: "",
    capacity: 0,
    current_stock: 0,
    manager_name: "",
    contact_phone: "",
    status: "active" as "active" | "inactive" | "maintenance",
  });

  // Mock data for demonstration - replace with actual database queries
  const mockWarehouses: WarehouseData[] = [
    {
      id: "1",
      name: "Central Warehouse",
      location: "Industrial Area",
      city: "Lahore",
      capacity: 10000,
      current_stock: 7500,
      manager_name: "Ali Khan",
      contact_phone: "+92-300-1234567",
      status: "active",
      created_at: new Date().toISOString(),
    },
    {
      id: "2",
      name: "North Distribution Center",
      location: "Main Boulevard",
      city: "Islamabad",
      capacity: 8000,
      current_stock: 5200,
      manager_name: "Sara Ahmed",
      contact_phone: "+92-301-9876543",
      status: "active",
      created_at: new Date().toISOString(),
    },
    {
      id: "3",
      name: "South Hub",
      location: "Port Area",
      city: "Karachi",
      capacity: 12000,
      current_stock: 9800,
      manager_name: "Ahmed Raza",
      contact_phone: "+92-302-5556789",
      status: "maintenance",
      created_at: new Date().toISOString(),
    },
  ];

  const warehouses = mockWarehouses;

  const filteredWarehouses = warehouses.filter(
    (wh) =>
      wh.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wh.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wh.manager_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCapacity = warehouses.reduce((sum, wh) => sum + wh.capacity, 0);
  const totalStock = warehouses.reduce((sum, wh) => sum + wh.current_stock, 0);
  const utilizationRate = ((totalStock / totalCapacity) * 100).toFixed(1);

  const handleAddWarehouse = () => {
    setSelectedWarehouse(null);
    setFormData({
      name: "",
      location: "",
      city: "",
      capacity: 0,
      current_stock: 0,
      manager_name: "",
      contact_phone: "",
      status: "active",
    });
    setDialogOpen(true);
  };

  const handleEditWarehouse = (warehouse: WarehouseData) => {
    setSelectedWarehouse(warehouse);
    setFormData({
      name: warehouse.name,
      location: warehouse.location,
      city: warehouse.city,
      capacity: warehouse.capacity,
      current_stock: warehouse.current_stock,
      manager_name: warehouse.manager_name,
      contact_phone: warehouse.contact_phone,
      status: warehouse.status,
    });
    setDialogOpen(true);
  };

  const handleSaveWarehouse = () => {
    toast({
      title: selectedWarehouse ? "Warehouse Updated" : "Warehouse Added",
      description: `Warehouse "${formData.name}" has been ${selectedWarehouse ? "updated" : "added"} successfully.`,
    });
    setDialogOpen(false);
  };

  const handleDeleteWarehouse = (id: string) => {
    toast({
      title: "Warehouse Deleted",
      description: "Warehouse has been removed successfully.",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-red-100 text-red-800",
      maintenance: "bg-yellow-100 text-yellow-800",
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.active;
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <CardTitle className="text-sm font-medium text-gray-600">Total Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCapacity.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalStock.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">units</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Utilization Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{utilizationRate}%</div>
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
                <TableHead>Location</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Current Stock</TableHead>
                <TableHead>Utilization</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWarehouses.map((warehouse) => {
                const utilization = ((warehouse.current_stock / warehouse.capacity) * 100).toFixed(1);
                return (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.location}</TableCell>
                    <TableCell>{warehouse.city}</TableCell>
                    <TableCell>{warehouse.capacity.toLocaleString()}</TableCell>
                    <TableCell>{warehouse.current_stock.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${utilization}%` }}
                          />
                        </div>
                        <span className="text-xs">{utilization}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium text-sm">{warehouse.manager_name}</div>
                        <div className="text-xs text-muted-foreground">{warehouse.contact_phone}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadge(warehouse.status)}>
                        {warehouse.status}
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
              <Label>Location</Label>
              <Input
                placeholder="e.g., Industrial Area"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Capacity</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label>Current Stock</Label>
                <Input
                  type="number"
                  placeholder="7500"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Manager Name</Label>
              <Input
                placeholder="e.g., Ali Khan"
                value={formData.manager_name}
                onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
              />
            </div>
            <div>
              <Label>Contact Phone</Label>
              <Input
                placeholder="e.g., +92-300-1234567"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              />
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
