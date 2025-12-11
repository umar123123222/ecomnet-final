import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Package, AlertTriangle, Edit, Trash2, PackagePlus, CheckCircle, MapPin } from "lucide-react";
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
  const { permissions } = useUserRoles();
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

  const filteredItems = packagingItems?.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStockStatus = (item: any) => {
    if (item.current_stock === 0) return { label: "Out of Stock", variant: "destructive" as const };
    if (item.current_stock <= item.reorder_level) return { label: "Low Stock", variant: "secondary" as const };
    return { label: "In Stock", variant: "default" as const };
  };

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

      <StatsGrid columns={3}>
        <StatsCard
          title="Total Items"
          value={packagingItems?.length || 0}
          icon={Package}
        />
        <StatsCard
          title="Low Stock Items"
          value={packagingItems?.filter(i => i.current_stock <= i.reorder_level).length || 0}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatsCard
          title="Active Items"
          value={packagingItems?.filter(i => i.is_active).length || 0}
          icon={CheckCircle}
          variant="success"
        />
      </StatsGrid>

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

      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search packaging items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={selectedOutlet} onValueChange={setSelectedOutlet}>
            <SelectTrigger className="w-[180px]">
              <MapPin className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by outlet" />
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

        <Table>
          <TableHeader>
            <TableRow>
              {permissions.canManagePackaging && (
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
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={permissions.canManagePackaging ? 13 : 12} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredItems?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={permissions.canManagePackaging ? 13 : 12} className="text-center">
                  No packaging items found
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
                  <TableRow key={item.id}>
                    {permissions.canManagePackaging && (
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell className="capitalize">{item.type}</TableCell>
                    <TableCell>
                      <Badge variant={item.allocation_type === 'none' ? 'outline' : 'secondary'}>
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
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">PKR {item.cost.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {permissions.canManagePackaging && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Packaging Item" : "Add New Packaging Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the packaging item details below"
                : "Enter the details for the new packaging item"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 500ml Plastic Bottle" {...field} />
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
                      <FormLabel>SKU *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PKG-BTL-500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bottle">Bottle</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                          <SelectItem value="label">Label</SelectItem>
                          <SelectItem value="cap">Cap</SelectItem>
                          <SelectItem value="bag">Bag</SelectItem>
                          <SelectItem value="wrapper">Wrapper</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
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
                        <Input placeholder="e.g., 500ml, 10x15cm" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="material"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Material</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Plastic, Cardboard" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier (Optional)</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : value)} 
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select supplier" />
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

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost (PKR) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
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
                      <FormLabel>Current Stock *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
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
                      <FormLabel>Reorder Level *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                          <SelectTrigger>
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
                        {field.value === 'per_product' && 'One packaging item per product unit in pending orders'}
                        {field.value === 'product_specific' && 'Only for specific linked products'}
                        {field.value === 'per_order_rules' && 'Based on order packaging rules (e.g., flyers)'}
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
                            <SelectTrigger>
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
                                  className="cursor-pointer"
                                  onClick={() => field.onChange((field.value || []).filter((id: string) => id !== productId))}
                                >
                                  {product?.name || productId}
                                  <span className="ml-1">×</span>
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

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
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

              <DialogFooter>
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
