import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Location {
  id: string;
  name: string;
  city: string;
  area: string;
  postal_code?: string | null;
  is_serviceable: boolean;
  available_couriers: string[];
  created_at: string;
  updated_at: string;
}

const LocationsDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    area: "",
    postal_code: "",
    is_serviceable: true,
    available_couriers: [] as string[],
  });

  // Fetch locations
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Location[];
    },
  });

  // Create location mutation
  const createLocationMutation = useMutation({
    mutationFn: async (data: Omit<Location, "id" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("locations").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({
        title: "Location Added",
        description: `Location "${formData.name}" has been added successfully.`,
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

  // Update location mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Location> }) => {
      const { error } = await supabase.from("locations").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({
        title: "Location Updated",
        description: `Location "${formData.name}" has been updated successfully.`,
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

  // Delete location mutation
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      toast({
        title: "Location Deleted",
        description: "Location has been removed successfully.",
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

  const filteredLocations = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loc.area.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddLocation = () => {
    setSelectedLocation(null);
    setFormData({
      name: "",
      city: "",
      area: "",
      postal_code: "",
      is_serviceable: true,
      available_couriers: [],
    });
    setDialogOpen(true);
  };

  const handleEditLocation = (location: Location) => {
    setSelectedLocation(location);
    setFormData({
      name: location.name,
      city: location.city,
      area: location.area,
      postal_code: location.postal_code || "",
      is_serviceable: location.is_serviceable,
      available_couriers: location.available_couriers,
    });
    setDialogOpen(true);
  };

  const handleSaveLocation = () => {
    if (selectedLocation) {
      updateLocationMutation.mutate({
        id: selectedLocation.id,
        data: formData,
      });
    } else {
      createLocationMutation.mutate(formData);
    }
  };

  const handleDeleteLocation = (id: string) => {
    if (confirm("Are you sure you want to delete this location?")) {
      deleteLocationMutation.mutate(id);
    }
  };

  const toggleCourier = (courier: string) => {
    setFormData((prev) => ({
      ...prev,
      available_couriers: prev.available_couriers.includes(courier)
        ? prev.available_couriers.filter((c) => c !== courier)
        : [...prev.available_couriers, courier],
    }));
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
          <MapPin className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Locations</h1>
            <p className="text-muted-foreground">Manage delivery zones and service areas</p>
          </div>
        </div>
        <Button onClick={handleAddLocation}>
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Locations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{locations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Serviceable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {locations.filter((l) => l.is_serviceable).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Cities Covered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(locations.map((l) => l.city)).size}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Non-Serviceable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {locations.filter((l) => !l.is_serviceable).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Locations Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Locations ({filteredLocations.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search locations..."
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
                <TableHead>Location Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Postal Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Couriers</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLocations.map((location) => (
                <TableRow key={location.id}>
                  <TableCell className="font-medium">{location.name}</TableCell>
                  <TableCell>{location.city}</TableCell>
                  <TableCell>{location.area}</TableCell>
                  <TableCell>{location.postal_code || "N/A"}</TableCell>
                  <TableCell>
                    <Badge className={location.is_serviceable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                      {location.is_serviceable ? "Serviceable" : "Non-Serviceable"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {location.available_couriers.map((courier) => (
                        <Badge key={courier} variant="outline" className="text-xs capitalize">
                          {courier}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditLocation(location)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteLocation(location.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Location Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedLocation ? "Edit Location" : "Add New Location"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Location Name</Label>
              <Input
                placeholder="e.g., Gulberg"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              <Label>Area</Label>
              <Input
                placeholder="e.g., Gulberg III"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
              />
            </div>
            <div>
              <Label>Postal Code (Optional)</Label>
              <Input
                placeholder="e.g., 54000"
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
              />
            </div>
            <div>
              <Label>Service Status</Label>
              <Select
                value={formData.is_serviceable ? "serviceable" : "non-serviceable"}
                onValueChange={(v) => setFormData({ ...formData, is_serviceable: v === "serviceable" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="serviceable">Serviceable</SelectItem>
                  <SelectItem value="non-serviceable">Non-Serviceable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Courier Availability</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {["leopard", "tcs", "postex"].map((courier) => (
                  <Badge
                    key={courier}
                    variant={formData.available_couriers.includes(courier) ? "default" : "outline"}
                    className="cursor-pointer capitalize"
                    onClick={() => toggleCourier(courier)}
                  >
                    {courier}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLocation}>
              {selectedLocation ? "Update" : "Add"} Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationsDashboard;
