import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, FileText, Calendar, DollarSign, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  suppliers: { name: string } | null;
  outlets: { name: string } | null;
}

const PurchaseOrderDashboard = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; po: PurchaseOrder | null }>({ open: false, po: null });

  const [formData, setFormData] = useState({
    supplier_id: '',
    outlet_id: '',
    expected_delivery_date: '',
    notes: ''
  });
  
  const [selectedItems, setSelectedItems] = useState<Array<{
    id: string;
    name: string;
    type: 'product' | 'packaging';
    quantity: number;
    unit_price: number;
  }>>([]);

  // Fetch POs
  const { data: purchaseOrders = [], isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers(name),
          outlets(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PurchaseOrder[];
    }
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, code')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch main warehouse
  const { data: mainWarehouse } = useQuery({
    queryKey: ['main-warehouse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('id, name')
        .eq('outlet_type', 'warehouse')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch supplier assigned products (from supplier_products table)
  const { data: supplierProducts = [] } = useQuery({
    queryKey: ['supplier-assigned-products', formData.supplier_id],
    queryFn: async () => {
      if (!formData.supplier_id) return [];
      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          id,
          unit_cost,
          product_id,
          packaging_item_id,
          products!supplier_products_product_id_fkey(id, name, sku, cost),
          packaging_items!supplier_products_packaging_item_id_fkey(id, name, sku, cost)
        `)
        .eq('supplier_id', formData.supplier_id);
      if (error) throw error;
      
      // Separate products and packaging
      const products = data?.filter(sp => sp.product_id && sp.products).map(sp => ({
        id: sp.products!.id,
        name: sp.products!.name,
        sku: sp.products!.sku,
        cost: sp.unit_cost || sp.products!.cost || 0
      })) || [];
      
      return products;
    },
    enabled: !!formData.supplier_id
  });

  // Fetch supplier assigned packaging (from supplier_products table)
  const { data: supplierPackaging = [] } = useQuery({
    queryKey: ['supplier-assigned-packaging', formData.supplier_id],
    queryFn: async () => {
      if (!formData.supplier_id) return [];
      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          id,
          unit_cost,
          product_id,
          packaging_item_id,
          packaging_items!supplier_products_packaging_item_id_fkey(id, name, sku, cost)
        `)
        .eq('supplier_id', formData.supplier_id)
        .not('packaging_item_id', 'is', null);
      if (error) throw error;
      
      const packaging = data?.filter(sp => sp.packaging_item_id && sp.packaging_items).map(sp => ({
        id: sp.packaging_items!.id,
        name: sp.packaging_items!.name,
        sku: sp.packaging_items!.sku,
        cost: sp.unit_cost || sp.packaging_items!.cost || 0
      })) || [];
      
      return packaging;
    },
    enabled: !!formData.supplier_id
  });

  // Set main warehouse as default when loaded
  useEffect(() => {
    if (mainWarehouse && !formData.outlet_id) {
      setFormData(prev => ({ ...prev, outlet_id: mainWarehouse.id }));
    }
  }, [mainWarehouse]);

  // Reset items when supplier changes
  useEffect(() => {
    setSelectedItems([]);
  }, [formData.supplier_id]);

  // Generate PO number
  const generatePONumber = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `PO-${year}-${random}`;
  };

  // Create PO
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const poNumber = generatePONumber();
      const totalAmount = selectedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          ...data,
          po_number: poNumber,
          created_by: profile?.id,
          total_amount: totalAmount,
          status: 'draft'
        }])
        .select()
        .single();
      
      if (poError) throw poError;

      // Create PO items
      const poItems = selectedItems.map(item => ({
        po_id: poData.id,
        product_id: item.type === 'product' ? item.id : null,
        packaging_item_id: item.type === 'packaging' ? item.id : null,
        quantity_ordered: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems);
      
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: 'Purchase Order Created',
        description: 'The purchase order has been created successfully.'
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Cancel PO
  const cancelMutation = useMutation({
    mutationFn: async (poId: string) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', poId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast({
        title: 'Purchase Order Cancelled',
        description: 'The purchase order has been cancelled successfully.'
      });
      setCancelDialog({ open: false, po: null });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      setCancelDialog({ open: false, po: null });
    }
  });

  const resetForm = () => {
    setFormData({
      supplier_id: '',
      outlet_id: mainWarehouse?.id || '',
      expected_delivery_date: '',
      notes: ''
    });
    setSelectedItems([]);
  };

  const addItem = (itemId: string, itemName: string, itemType: 'product' | 'packaging', cost: number) => {
    if (selectedItems.find(i => i.id === itemId)) return;
    setSelectedItems([...selectedItems, {
      id: itemId,
      name: itemName,
      type: itemType,
      quantity: 1,
      unit_price: cost || 0
    }]);
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(selectedItems.map(item => 
      item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
    ));
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== itemId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedItems.length === 0) {
      toast({
        title: 'Error',
        description: 'Please add at least one item to the purchase order',
        variant: 'destructive'
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredPOs = purchaseOrders.filter(po =>
    po.po_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      draft: { variant: 'secondary', label: 'Draft' },
      sent: { variant: 'outline', label: 'Sent' },
      confirmed: { variant: 'default', label: 'Confirmed' },
      partially_received: { variant: 'outline', label: 'Partial' },
      completed: { variant: 'default', label: 'Completed' },
      cancelled: { variant: 'destructive', label: 'Cancelled' }
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const stats = {
    draft: purchaseOrders.filter(po => po.status === 'draft').length,
    sent: purchaseOrders.filter(po => po.status === 'sent' || po.status === 'confirmed').length,
    inTransit: purchaseOrders.filter(po => po.status === 'partially_received').length,
    completed: purchaseOrders.filter(po => po.status === 'completed').length
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage purchase orders and supplier orders</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Create PO
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Purchase Order</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="supplier_id">Supplier *</Label>
                <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map(supplier => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name} ({supplier.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="outlet_id">Receiving Location</Label>
                <Input 
                  value={mainWarehouse?.name || 'Main Warehouse'} 
                  disabled 
                  className="bg-muted"
                />
              </div>

              <div>
                <Label htmlFor="expected_delivery_date">Recommended Delivery Date</Label>
                <Input
                  id="expected_delivery_date"
                  type="date"
                  value={formData.expected_delivery_date}
                  onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                />
              </div>

              <div>
                <Label>Items</Label>
                <div className="space-y-2">
                  <Select onValueChange={(value) => {
                    const [type, id] = value.split(':');
                    const item = type === 'product' 
                      ? supplierProducts.find(p => p.id === id)
                      : supplierPackaging.find(p => p.id === id);
                    if (item) {
                      addItem(item.id, item.name, type as 'product' | 'packaging', item.cost || 0);
                    }
                  }} disabled={!formData.supplier_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select item to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {supplierProducts.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-sm font-semibold">Products</div>
                          {supplierProducts.map(product => (
                            <SelectItem key={`product:${product.id}`} value={`product:${product.id}`}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {supplierPackaging.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-sm font-semibold">Packaging</div>
                          {supplierPackaging.map(pkg => (
                            <SelectItem key={`packaging:${pkg.id}`} value={`packaging:${pkg.id}`}>
                              {pkg.name} ({pkg.sku})
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {supplierProducts.length === 0 && supplierPackaging.length === 0 && (
                        <div className="px-2 py-1.5 text-sm text-muted-foreground">No items available</div>
                      )}
                    </SelectContent>
                  </Select>

                  {selectedItems.length > 0 && (
                    <div className="border rounded-md divide-y">
                      {selectedItems.map(item => (
                        <div key={item.id} className="p-3 flex items-center gap-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                          </div>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                            className="w-20"
                            placeholder="Qty"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.id)}
                          >
                            ×
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || !formData.supplier_id || !formData.outlet_id || selectedItems.length === 0}>
                  {createMutation.isPending ? 'Creating...' : 'Create PO'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sent/Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Transit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inTransit}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by PO number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="partially_received">Partial</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* PO List */}
      {isLoading ? (
        <div className="text-center py-12">Loading purchase orders...</div>
      ) : filteredPOs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No purchase orders found. Create your first PO to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPOs.map((po) => (
            <Card key={po.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{po.po_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {po.suppliers?.name} → {po.outlets?.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(po.order_date), 'MMM dd, yyyy')}</span>
                      </div>
                      {po.expected_delivery_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Expected: {format(new Date(po.expected_delivery_date), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>${po.total_amount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(po.status)}
                    {['draft', 'sent', 'confirmed'].includes(po.status) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancelDialog({ open: true, po })}
                        className="text-destructive hover:text-destructive"
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Cancel PO
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={(open) => setCancelDialog({ ...cancelDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel <strong>{cancelDialog.po?.po_number}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Mark the PO as cancelled</li>
                <li>Prevent any further receiving or processing</li>
                <li>Notify the supplier (if already sent)</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep PO</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelDialog.po && cancelMutation.mutate(cancelDialog.po.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel PO'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PurchaseOrderDashboard;
