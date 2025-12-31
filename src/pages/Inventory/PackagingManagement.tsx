import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, PackagePlus, CheckCircle, MapPin, DollarSign, Boxes, Tag, Link2, Box, Filter, PackageX, TrendingDown, Layers } from "lucide-react";
import { PageContainer, PageHeader, StatsCard, StatsGrid } from "@/components/layout";
import { useToast } from "@/hooks/use-toast";
import { useBulkOperations } from "@/hooks/useBulkOperations";
import { bulkDeletePackagingItems } from "@/utils/bulkOperations";
import { BulkOperationsPanelLegacy as BulkOperationsPanel } from "@/components/BulkOperationsPanelLegacy";
import { useReservationDateFilter } from "@/hooks/useReservationDateFilter";
import { ReservationDateFilter } from "@/components/ReservationDateFilter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { PackagingAdjustmentDialog } from "@/components/inventory/PackagingAdjustmentDialog";
import { PackagingRulesManager } from "@/components/inventory/PackagingRulesManager";
import { useUserRoles } from '@/hooks/useUserRoles';
import { Skeleton } from "@/components/ui/skeleton";

const packagingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(1, "SKU is required"),
  type: z.enum(['bottle', 'box', 'label', 'cap', 'bag', 'wrapper', 'other']),
  size: z.string().optional(),
  material: z.string().optional(),
  cost: z.number().min(0, "Cost must be positive"),
  reorder_level: z.number().int().min(0),
  current_stock: z.number().int().min(0),
  is_active: z.boolean().default(true),
  supplier_id: z.string().optional(),
  allocation_type: z.enum(['per_product', 'product_specific', 'per_order_rules', 'none']).default('none'),
  linked_product_ids: z.array(z.string()).default([]),
});

type PackagingFormData = z.infer<typeof packagingSchema>;

export default function PackagingManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions, primaryRole } = useUserRoles();
  const isFinanceUser = primaryRole === 'finance';
  const { progress, executeBulkOperation, resetProgress } = useBulkOperations();
  
  // Date filter for reserved quantities
  const {
    dateRange,
    setDateRange,
    isFiltered: isDateFiltered,
    packagingReservations: filteredReservations,
    isLoadingPackaging: isLoadingReservations,
    clearDateFilter
  } = useReservationDateFilter();

  // Fetch outlets
  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const { data: packagingItems, isLoading } = useQuery({
    queryKey: ["packaging-items", selectedOutlet],
    queryFn: async () => {
      // Fetch central packaging items
      const { data: items, error } = await supabase
        .from("packaging_items")
        .select("*")
        .order("name");
      if (error) throw error;

      // If filtering by outlet, fetch outlet-specific inventory
      if (selectedOutlet !== "all") {
        const { data: outletInventory } = await supabase
          .from("outlet_packaging_inventory")
          .select("packaging_item_id, quantity")
          .eq("outlet_id", selectedOutlet);
        
        // Create a map of outlet-specific quantities
        const outletQtyMap = new Map<string, number>();
        outletInventory?.forEach((inv: any) => {
          outletQtyMap.set(inv.packaging_item_id, inv.quantity || 0);
        });

        // Return items with outlet-specific stock
        return items?.map(item => ({
          ...item,
          current_stock: outletQtyMap.get(item.id) || 0,
          reserved_quantity: 0 // Outlet-specific reservations not tracked separately
        }));
      }

      // Fetch reserved quantities using RPC function that calculates from pending/booked orders + packaging rules
      const { data: reservedData } = await supabase.rpc('get_packaging_reservations');

      // Create a map of packaging_item_id -> reserved_count
      const reservedMap = new Map<string, number>();
      reservedData?.forEach((item: { packaging_item_id: string; reserved_count: number }) => {
        reservedMap.set(item.packaging_item_id, Number(item.reserved_count));
      });

      // Add reserved_quantity to each item
      return items?.map(item => ({
        ...item,
        reserved_quantity: reservedMap.get(item.id) || 0
      }));
    },
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch products for product-specific allocation
  const { data: products = [] } = useQuery({
    queryKey: ['products-for-packaging'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  const form = useForm<PackagingFormData>({
    resolver: zodResolver(packagingSchema),
    defaultValues: {
      name: "",
      sku: "",
      type: "bottle",
      size: "",
      material: "",
      cost: 0,
      reorder_level: 50,
      current_stock: 0,
      is_active: true,
      supplier_id: undefined,
      allocation_type: "none",
      linked_product_ids: [],
    },
  });

  const watchAllocationType = form.watch('allocation_type');

  const createMutation = useMutation({
    mutationFn: async (data: PackagingFormData) => {
      const { error } = await supabase.from("packaging_items").insert([data as any]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      toast({ title: "Packaging item created successfully" });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error creating packaging item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PackagingFormData) => {
      const { error } = await supabase
        .from("packaging_items")
        .update(data as any)
        .eq("id", editingItem.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
      toast({ title: "Packaging item updated successfully" });
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error updating packaging item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PackagingFormData) => {
    if (editingItem) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    form.reset({
      name: item.name,
      sku: item.sku,
      type: item.type,
      size: item.size || "",
      material: item.material || "",
      cost: item.cost,
      reorder_level: item.reorder_level,
      current_stock: item.current_stock,
      is_active: item.is_active,
      supplier_id: item.supplier_id || undefined,
      allocation_type: item.allocation_type || "none",
      linked_product_ids: item.linked_product_ids || [],
    });
    setDialogOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    form.reset();
    setDialogOpen(true);
  };

  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredItems = packagingItems?.filter(
    (item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      return matchesSearch && matchesType;
    }
  );

  const getStockStatus = (item: any) => {
    if (item.current_stock === 0) return { label: "Out of Stock", variant: "destructive" as const, icon: PackageX };
    if (item.current_stock <= item.reorder_level) return { label: "Low Stock", variant: "secondary" as const, icon: TrendingDown };
    return { label: "In Stock", variant: "default" as const, icon: CheckCircle };
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'bottle': '🍶',
      'box': '📦',
      'label': '🏷️',
      'cap': '🧢',
      'bag': '👜',
      'wrapper': '🎁',
      'other': '📋'
    };
    return icons[type] || '📦';
  };

  // Calculate stats
  const totalItems = packagingItems?.length || 0;
  const lowStockItems = packagingItems?.filter(i => i.current_stock <= i.reorder_level && i.current_stock > 0).length || 0;
  const outOfStockItems = packagingItems?.filter(i => i.current_stock === 0).length || 0;
  const activeItems = packagingItems?.filter(i => i.is_active).length || 0;
  const totalValue = packagingItems?.reduce((sum, i) => sum + (i.current_stock * i.cost), 0) || 0;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(filteredItems?.map(item => item.id) || []);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      setSelectedItems(prev => [...prev, itemId]);
    } else {
      setSelectedItems(prev => prev.filter(id => id !== itemId));
    }
  };

  const bulkOperations = [
    {
      id: 'delete',
      label: 'Delete Selected',
      icon: Trash2,
      action: async (selectedIds: string[]) => {
        return await bulkDeletePackagingItems(selectedIds);
      },
      confirmMessage: 'Are you sure you want to delete the selected packaging items? This action cannot be undone.',
      variant: 'destructive' as const,
      requiresConfirmation: true,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Packaging Management"
        description="Manage packaging materials like bottles, boxes, and labels"
        icon={Package}
        actions={
          <>
            {permissions.canAdjustPackagingStock && (
              <Button onClick={() => setAdjustmentDialogOpen(true)} variant="secondary">
                <PackagePlus className="mr-2 h-4 w-4" />
                Stock Adjustment
              </Button>
            )}
            {permissions.canManagePackaging && (
              <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" />
                Add Packaging Item
              </Button>
            )}
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold">{totalItems}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-orange-200 dark:border-orange-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-orange-600">{lowStockItems}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-red-200 dark:border-red-900/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{outOfStockItems}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <PackageX className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-2xl font-bold">PKR {totalValue.toLocaleString()}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {permissions.canManagePackaging && selectedItems.length > 0 && (
        <BulkOperationsPanel
          selectedCount={selectedItems.length}
          operations={bulkOperations}
          onExecute={(operation) => {
            executeBulkOperation(operation, selectedItems, () => {
              setSelectedItems([]);
              queryClient.invalidateQueries({ queryKey: ["packaging-items"] });
            });
          }}
          progress={progress}
        />
      )}

      {/* Main Table Card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Packaging Inventory
              </CardTitle>
              <CardDescription>
                {filteredItems?.length || 0} items {searchTerm || typeFilter !== "all" ? "found" : "total"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6 p-4 bg-muted/30 rounded-lg border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px] bg-background">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="bottle">🍶 Bottle</SelectItem>
                  <SelectItem value="box">📦 Box</SelectItem>
                  <SelectItem value="label">🏷️ Label</SelectItem>
                  <SelectItem value="cap">🧢 Cap</SelectItem>
                  <SelectItem value="bag">👜 Bag</SelectItem>
                  <SelectItem value="wrapper">🎁 Wrapper</SelectItem>
                  <SelectItem value="other">📋 Other</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
                <SelectTrigger className="w-[180px] bg-background">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Outlets (Central)</SelectItem>
                  {outlets.map((outlet: any) => (
                    <SelectItem key={outlet.id} value={outlet.id}>{outlet.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <ReservationDateFilter
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                onClear={clearDateFilter}
                isLoading={isLoadingReservations}
              />
            </div>
          </div>

        <Table>
          <TableHeader>
            <TableRow>
              {!isFinanceUser && permissions.canManagePackaging && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedItems.length === filteredItems?.length && filteredItems?.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Allocation</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Available</TableHead>
              <TableHead className="text-right">Reorder Level</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              {!isFinanceUser && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {!isFinanceUser && permissions.canManagePackaging && (
                    <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  )}
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  {!isFinanceUser && <TableCell><Skeleton className="h-8 w-16" /></TableCell>}
                </TableRow>
              ))
            ) : filteredItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isFinanceUser ? 12 : (permissions.canManagePackaging ? 13 : 12)} className="h-48">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-lg mb-1">No packaging items found</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {searchTerm || typeFilter !== "all" 
                        ? "Try adjusting your search or filters" 
                        : "Get started by adding your first packaging item"}
                    </p>
                    {permissions.canManagePackaging && !searchTerm && typeFilter === "all" && (
                      <Button onClick={handleAddNew} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Packaging Item
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems?.map((item) => {
                const status = getStockStatus(item);
                const allocationLabel = {
                  'per_product': 'Per Product',
                  'product_specific': 'Product Specific',
                  'per_order_rules': 'Order Rules',
                  'none': '-'
                }[item.allocation_type || 'none'];
                return (
                  <TableRow key={item.id} className="group hover:bg-muted/50 transition-colors">
                    {!isFinanceUser && permissions.canManagePackaging && (
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getTypeIcon(item.type)}</span>
                        <span className="font-medium">{item.name}</span>
                        {!item.is_active && (
                          <Badge variant="outline" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{item.sku}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{item.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.allocation_type === 'none' ? 'outline' : 'secondary'} className="text-xs">
                        {allocationLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.size || "-"}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">{item.current_stock}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      {isDateFiltered ? (
                        <span className="text-primary font-medium">
                          {filteredReservations?.get(item.id) || 0}
                        </span>
                      ) : (
                        <span className="text-orange-600">{item.reserved_quantity || 0}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isDateFiltered ? (
                        <span className="font-medium text-green-600">
                          {item.current_stock - (filteredReservations?.get(item.id) || 0)}
                        </span>
                      ) : (
                        <span className="font-medium text-green-600">
                          {item.current_stock - (item.reserved_quantity || 0)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-muted-foreground">{item.reorder_level}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant} className="gap-1">
                        <status.icon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">PKR {item.cost.toFixed(2)}</TableCell>
                    {!isFinanceUser && (
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {permissions.canManagePackaging && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(item)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-lg">
                  {editingItem ? "Edit Packaging Item" : "Add New Packaging Item"}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {editingItem
                    ? "Update the packaging item details"
                    : "Add a new packaging material to your inventory"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col overflow-hidden">
              <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
                {/* Basic Info Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    Basic Information
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 500ml Plastic Bottle" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., PKG-BTL-500" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="bottle">🧴 Bottle</SelectItem>
                              <SelectItem value="box">📦 Box</SelectItem>
                              <SelectItem value="label">🏷️ Label</SelectItem>
                              <SelectItem value="cap">🔘 Cap</SelectItem>
                              <SelectItem value="bag">👜 Bag</SelectItem>
                              <SelectItem value="wrapper">🎁 Wrapper</SelectItem>
                              <SelectItem value="other">📋 Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Size</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., 500ml" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="material"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Material</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Plastic" {...field} className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="supplier_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Supplier</FormLabel>
                        <Select 
                          onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} 
                          value={field.value || "none"}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Select supplier (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Supplier</SelectItem>
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={supplier.id}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Stock & Pricing Section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <DollarSign className="h-4 w-4" />
                    Stock & Pricing
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="cost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost (PKR) <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">Rs.</span>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                className="h-9 pl-10"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="current_stock"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Stock <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              className="h-9"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reorder_level"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reorder Level <span className="text-destructive">*</span></FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                              className="h-9"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Allocation Section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    Allocation Settings
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="allocation_type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Allocation Type</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">None (Manual Only)</SelectItem>
                              <SelectItem value="per_product">Per Product (1 per unit)</SelectItem>
                              <SelectItem value="product_specific">Product Specific</SelectItem>
                              <SelectItem value="per_order_rules">Per Order Rules</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {field.value === 'per_product' && 'One item per product unit in orders'}
                            {field.value === 'product_specific' && 'Only for specific linked products'}
                            {field.value === 'per_order_rules' && 'Based on order rules (e.g., flyers)'}
                            {field.value === 'none' && 'No automatic reservation'}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {watchAllocationType === 'product_specific' && (
                      <FormField
                        control={form.control}
                        name="linked_product_ids"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Linked Products</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                const current = field.value || [];
                                if (current.includes(value)) {
                                  field.onChange(current.filter(id => id !== value));
                                } else {
                                  field.onChange([...current, value]);
                                }
                              }}
                              value=""
                            >
                              <FormControl>
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Add product..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {products.filter(p => !(field.value || []).includes(p.id)).map((product) => (
                                  <SelectItem key={product.id} value={product.id}>
                                    {product.name} ({product.sku})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {(field.value || []).length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(field.value || []).map((productId: string) => {
                                  const product = products.find(p => p.id === productId);
                                  return (
                                    <Badge
                                      key={productId}
                                      variant="secondary"
                                      className="cursor-pointer hover:bg-destructive/10"
                                      onClick={() => field.onChange((field.value || []).filter((id: string) => id !== productId))}
                                    >
                                      {product?.name || productId}
                                      <span className="ml-1 text-muted-foreground">×</span>
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Active Status */}
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-background flex items-center justify-center border">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="space-y-0.5">
                          <FormLabel className="font-medium cursor-pointer">Active Item</FormLabel>
                          <p className="text-xs text-muted-foreground">Item will be available for use</p>
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="px-6 py-4 border-t bg-muted/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    setEditingItem(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="min-w-[140px]"
                >
                  {editingItem ? "Update" : "Create"} Packaging Item
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <PackagingAdjustmentDialog
        open={adjustmentDialogOpen}
        onOpenChange={setAdjustmentDialogOpen}
        packagingItems={packagingItems || []}
      />

      <PackagingRulesManager />
    </PageContainer>
  );
}
