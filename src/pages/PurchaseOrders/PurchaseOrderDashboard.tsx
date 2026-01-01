import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, FileText, Calendar, DollarSign, XCircle, CheckCircle, CreditCard, Loader2, ClipboardList, Package, Truck, Building2, ArrowRight, Minus, X } from 'lucide-react';
import { PageContainer, PageHeader, StatsCard } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { format } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
interface PurchaseOrder {
  id: string;
  po_number: string;
  status: string;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  paid_amount: number | null;
  payment_reference: string | null;
  payment_status: string | null;
  supplier_payment_confirmed: boolean | null;
  suppliers: {
    name: string;
  } | null;
  outlets: {
    name: string;
  } | null;
  profiles: {
    full_name: string | null;
    email: string;
  } | null;
}
const PurchaseOrderDashboard = () => {
  const {
    toast
  } = useToast();
  const {
    profile
  } = useAuth();
  const queryClient = useQueryClient();
  const {
    currency
  } = useCurrency();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    po: PurchaseOrder | null;
  }>({
    open: false,
    po: null
  });
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    po: PurchaseOrder | null;
    suggestedAmount: number | null;
  }>({
    open: false,
    po: null,
    suggestedAmount: null
  });
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);
  const [itemSearch, setItemSearch] = useState('');
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
    sku: string;
  }>>([]);

  // Fetch POs
  const {
    data: purchaseOrders = [],
    isLoading
  } = useQuery({
    queryKey: ['purchase-orders', statusFilter],
    queryFn: async () => {
      let query = supabase.from('purchase_orders').select(`
          *,
          suppliers(name),
          outlets(name),
          profiles!purchase_orders_created_by_fkey(full_name, email)
        `).order('created_at', {
        ascending: false
      });
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      const {
        data,
        error
      } = await query;
      if (error) throw error;
      return data as PurchaseOrder[];
    }
  });

  // Fetch suppliers
  const {
    data: suppliers = []
  } = useQuery({
    queryKey: ['suppliers-active'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('suppliers').select('id, name, code').eq('status', 'active').order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch main warehouse
  const {
    data: mainWarehouse
  } = useQuery({
    queryKey: ['main-warehouse'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('outlets').select('id, name').eq('outlet_type', 'warehouse').eq('is_active', true).limit(1).single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch supplier assigned products
  const {
    data: supplierProducts = []
  } = useQuery({
    queryKey: ['supplier-assigned-products', formData.supplier_id],
    queryFn: async () => {
      if (!formData.supplier_id) return [];
      const {
        data,
        error
      } = await supabase.from('supplier_products').select(`
          id,
          unit_cost,
          product_id,
          packaging_item_id,
          products!supplier_products_product_id_fkey(id, name, sku, cost),
          packaging_items!supplier_products_packaging_item_id_fkey(id, name, sku, cost)
        `).eq('supplier_id', formData.supplier_id);
      if (error) throw error;
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

  // Fetch supplier assigned packaging
  const {
    data: supplierPackaging = []
  } = useQuery({
    queryKey: ['supplier-assigned-packaging', formData.supplier_id],
    queryFn: async () => {
      if (!formData.supplier_id) return [];
      const {
        data,
        error
      } = await supabase.from('supplier_products').select(`
          id,
          unit_cost,
          product_id,
          packaging_item_id,
          packaging_items!supplier_products_packaging_item_id_fkey(id, name, sku, cost)
        `).eq('supplier_id', formData.supplier_id).not('packaging_item_id', 'is', null);
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
      setFormData(prev => ({
        ...prev,
        outlet_id: mainWarehouse.id
      }));
    }
  }, [mainWarehouse]);

  // Reset items when supplier changes
  useEffect(() => {
    setSelectedItems([]);
    setItemSearch('');
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
      const totalAmount = selectedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const insertData = {
        supplier_id: data.supplier_id,
        outlet_id: data.outlet_id,
        notes: data.notes || null,
        expected_delivery_date: data.expected_delivery_date || null,
        po_number: poNumber,
        created_by: profile?.id,
        total_amount: totalAmount,
        status: 'pending'
      };
      const {
        data: poData,
        error: poError
      } = await supabase.from('purchase_orders').insert([insertData]).select(`
          *,
          suppliers(name, code, email)
        `).single();
      if (poError) throw poError;
      const poItems = selectedItems.map(item => ({
        po_id: poData.id,
        product_id: item.type === 'product' ? item.id : null,
        packaging_item_id: item.type === 'packaging' ? item.id : null,
        quantity_ordered: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));
      const {
        error: itemsError
      } = await supabase.from('purchase_order_items').insert(poItems);
      if (itemsError) throw itemsError;
      try {
        await supabase.functions.invoke('send-po-notification', {
          body: {
            po_id: poData.id,
            supplier_email: poData.suppliers?.email || '',
            supplier_name: poData.suppliers?.name || 'Unknown',
            po_number: poNumber,
            total_amount: totalAmount,
            expected_delivery_date: data.expected_delivery_date || null,
            items: selectedItems.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unit_price: item.unit_price
            })),
            notify_admins: true
          }
        });
      } catch (emailError) {
        console.error('Failed to send PO notification emails:', emailError);
      }
      return poData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['purchase-orders']
      });
      toast({
        title: 'Purchase Order Created',
        description: 'The purchase order has been created successfully and notifications sent.'
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
      const {
        error
      } = await supabase.from('purchase_orders').update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      }).eq('id', poId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['purchase-orders']
      });
      toast({
        title: 'Purchase Order Cancelled',
        description: 'The purchase order has been cancelled successfully.'
      });
      setCancelDialog({
        open: false,
        po: null
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      setCancelDialog({
        open: false,
        po: null
      });
    }
  });

  // Record Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async (data: {
      po_id: string;
      amount: number;
      reference: string;
    }) => {
      const {
        data: result,
        error
      } = await supabase.functions.invoke('manage-purchase-order', {
        body: {
          action: 'record_payment',
          data: {
            po_id: data.po_id,
            amount: data.amount,
            payment_reference: data.reference
          }
        }
      });
      if (error) throw error;
      if (result?.error) throw new Error(result.error);
      return result;
    },
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: ['purchase-orders']
      });
      toast({
        title: 'Payment Recorded',
        description: `Payment recorded. Status: ${data.payment_status}`
      });
      setPaymentDialog({
        open: false,
        po: null,
        suggestedAmount: null
      });
      setPaymentAmount('');
      setPaymentReference('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
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
    setItemSearch('');
  };

  // Open payment dialog and calculate suggested amount
  const openPaymentDialog = async (po: PurchaseOrder) => {
    setLoadingSuggestion(true);
    setPaymentDialog({
      open: true,
      po,
      suggestedAmount: null
    });
    setPaymentAmount('');
    setPaymentReference('');
    try {
      const {
        data: grnData
      } = await supabase.from('goods_received_notes').select(`
          id,
          grn_items(
            quantity_received,
            unit_cost,
            po_item_id,
            purchase_order_items:po_item_id(unit_price)
          )
        `).eq('po_id', po.id).order('created_at', {
        ascending: false
      }).limit(1).maybeSingle();
      let suggestedAmount = 0;
      if (grnData?.grn_items && grnData.grn_items.length > 0) {
        suggestedAmount = grnData.grn_items.reduce((sum: number, item: any) => {
          const received = item.quantity_received || 0;
          const unitPrice = item.unit_cost || item.purchase_order_items?.unit_price || 0;
          return sum + received * unitPrice;
        }, 0);
        const {
          data: poData
        } = await supabase.from('purchase_orders').select('shipping_cost').eq('id', po.id).single();
        if (poData?.shipping_cost) {
          suggestedAmount += poData.shipping_cost;
        }
      } else {
        suggestedAmount = po.total_amount;
      }
      setPaymentDialog(prev => ({
        ...prev,
        suggestedAmount
      }));
    } catch (error) {
      console.error('Failed to calculate suggested amount:', error);
      setPaymentDialog(prev => ({
        ...prev,
        suggestedAmount: po.total_amount
      }));
    } finally {
      setLoadingSuggestion(false);
    }
  };
  const addItem = (itemId: string, itemName: string, itemType: 'product' | 'packaging', cost: number, sku: string) => {
    if (selectedItems.find(i => i.id === itemId)) return;
    setSelectedItems([...selectedItems, {
      id: itemId,
      name: itemName,
      type: itemType,
      quantity: 1,
      unit_price: cost || 0,
      sku
    }]);
    setItemSearch('');
  };
  const updateItemQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(selectedItems.map(item => item.id === itemId ? {
      ...item,
      quantity: Math.max(1, quantity)
    } : item));
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
  const filteredPOs = purchaseOrders.filter(po => po.po_number.toLowerCase().includes(searchTerm.toLowerCase()));

  // Filter available items for search
  const allAvailableItems = [...supplierProducts.map(p => ({
    ...p,
    type: 'product' as const
  })), ...supplierPackaging.map(p => ({
    ...p,
    type: 'packaging' as const
  }))].filter(item => !selectedItems.find(s => s.id === item.id) && (item.name.toLowerCase().includes(itemSearch.toLowerCase()) || item.sku.toLowerCase().includes(itemSearch.toLowerCase())));
  const getStatusBadge = (status: string) => {
    const variants: Record<string, {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      label: string;
      className?: string;
      icon?: any;
    }> = {
      pending: {
        variant: 'secondary',
        label: 'Awaiting Supplier',
        icon: ClipboardList
      },
      draft: {
        variant: 'secondary',
        label: 'Draft',
        icon: FileText
      },
      sent: {
        variant: 'outline',
        label: 'Sent to Supplier',
        icon: FileText
      },
      confirmed: {
        variant: 'default',
        label: 'Confirmed',
        icon: CheckCircle
      },
      supplier_rejected: {
        variant: 'destructive',
        label: 'Rejected',
        icon: XCircle
      },
      in_transit: {
        variant: 'default',
        label: 'In Transit',
        className: 'bg-blue-500 hover:bg-blue-600',
        icon: Truck
      },
      partially_received: {
        variant: 'outline',
        label: 'Partial',
        icon: Package
      },
      completed: {
        variant: 'default',
        label: 'Completed',
        className: 'bg-green-500 hover:bg-green-600',
        icon: CheckCircle
      },
      cancelled: {
        variant: 'destructive',
        label: 'Cancelled',
        icon: XCircle
      }
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return <Badge variant={config.variant} className={`${config.className || ''} gap-1`}>
        {Icon && <Icon className="h-3 w-3" />}
        {config.label}
      </Badge>;
  };
  const getPaymentBadge = (status: string | null) => {
    if (!status || status === 'pending') return <Badge variant="outline" className="gap-1"><DollarSign className="h-3 w-3" />Unpaid</Badge>;
    if (status === 'partial') return <Badge className="bg-orange-500 hover:bg-orange-600 gap-1"><DollarSign className="h-3 w-3" />Partial</Badge>;
    if (status === 'paid') return <Badge className="bg-green-500 hover:bg-green-600 gap-1"><CheckCircle className="h-3 w-3" />Paid</Badge>;
    return null;
  };
  const stats = {
    pending: purchaseOrders.filter(po => po.status === 'pending').length,
    sent: purchaseOrders.filter(po => po.status === 'sent' || po.status === 'confirmed').length,
    inTransit: purchaseOrders.filter(po => po.status === 'in_transit' || po.status === 'partially_received').length,
    completed: purchaseOrders.filter(po => po.status === 'completed').length,
    awaitingPayment: purchaseOrders.filter(po => (po.status === 'completed' || po.status === 'partially_received') && (po as any).payment_status !== 'paid').length
  };
  const totalValue = selectedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);
  return <PageContainer>
      <PageHeader title="Purchase Orders" description="Manage supplier orders and procurement" icon={ClipboardList} actions={<Button onClick={() => {
      resetForm();
      setIsDialogOpen(true);
    }} className="gap-2 px-[135px]">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create PO</span>
            <span className="sm:hidden">New</span>
          </Button>} />

      {/* Create PO Sheet - Same UX as Add Supplier */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent className={cn("overflow-y-auto", isMobile ? "w-full" : "sm:max-w-lg")}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Create Purchase Order
            </SheetTitle>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6">
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="items">
                  Items {selectedItems.length > 0 && `(${selectedItems.length})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-0">
                {/* Visual Route Header */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
                  <div className="flex items-center justify-center gap-3">
                    <div className="text-center">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-1">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-xs font-medium">{selectedSupplier?.name || 'Supplier'}</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="text-center">
                      <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-1">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <p className="text-xs font-medium">{mainWarehouse?.name || 'Warehouse'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplier_id">Supplier *</Label>
                  <Select value={formData.supplier_id} onValueChange={value => setFormData({
                  ...formData,
                  supplier_id: value
                })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(supplier => <SelectItem key={supplier.id} value={supplier.id}>
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {supplier.name} <span className="text-muted-foreground">({supplier.code})</span>
                          </span>
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outlet_id">Receiving Location</Label>
                  <Input value={mainWarehouse?.name || 'Main Warehouse'} disabled className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_delivery_date">Expected Delivery Date</Label>
                  <Input id="expected_delivery_date" type="date" value={formData.expected_delivery_date} onChange={e => setFormData({
                  ...formData,
                  expected_delivery_date: e.target.value
                })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea id="notes" value={formData.notes} onChange={e => setFormData({
                  ...formData,
                  notes: e.target.value
                })} placeholder="Add any notes for the supplier..." rows={3} />
                </div>
              </TabsContent>

              <TabsContent value="items" className="space-y-4 mt-0">
                {!formData.supplier_id ? <div className="text-center p-8 border-2 border-dashed rounded-lg">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Select a supplier first to view available items</p>
                  </div> : <>
                    {/* Item Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search products or packaging..." value={itemSearch} onChange={e => setItemSearch(e.target.value)} className="pl-10" />
                    </div>

                    {/* Search Results */}
                    {itemSearch && allAvailableItems.length > 0 && <Card className="border-dashed">
                        <ScrollArea className="max-h-[200px]">
                          <div className="p-2 space-y-1">
                            {allAvailableItems.slice(0, 10).map(item => <button key={item.id} type="button" onClick={() => addItem(item.id, item.name, item.type, item.cost, item.sku)} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors text-left">
                                <div className="flex items-center gap-3">
                                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.type === 'product' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                    <Package className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.sku} • {item.type}</p>
                                  </div>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {currency} {item.cost.toLocaleString()}
                                </Badge>
                              </button>)}
                          </div>
                        </ScrollArea>
                      </Card>}

                    {itemSearch && allAvailableItems.length === 0 && <div className="text-center py-4 text-sm text-muted-foreground">
                        No items found matching "{itemSearch}"
                      </div>}

                    {/* Selected Items */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">
                        Selected Items ({selectedItems.length})
                      </Label>
                      {selectedItems.length === 0 ? <div className="border-2 border-dashed rounded-lg p-6 text-center">
                          <Package className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">Search and add items above</p>
                        </div> : <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {selectedItems.map(item => <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'product' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                                <Package className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {currency} {item.unit_price.toLocaleString()} each
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item.id, item.quantity - 1)}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <Input type="number" min="1" value={item.quantity} onChange={e => updateItemQuantity(item.id, parseInt(e.target.value) || 1)} className="w-16 h-8 text-center" />
                                <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => updateItemQuantity(item.id, item.quantity + 1)}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => removeItem(item.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>)}
                        </div>}
                    </div>

                    {/* Total Value */}
                    {selectedItems.length > 0 && <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                        <span className="font-medium">Total Value</span>
                        <span className="text-lg font-bold text-primary">{currency} {totalValue.toLocaleString()}</span>
                      </div>}
                  </>}
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 mt-8 pt-4 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending || !formData.supplier_id || selectedItems.length === 0}>
                {createMutation.isPending ? <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </> : <>Create PO</>}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatsCard title="Pending" value={stats.pending} icon={ClipboardList} description="Awaiting supplier" onClick={() => setStatusFilter('pending')} className={statusFilter === 'pending' ? 'ring-2 ring-primary' : 'cursor-pointer hover:shadow-md transition-shadow'} />
        <StatsCard title="Confirmed" value={stats.sent} icon={CheckCircle} description="By supplier" onClick={() => setStatusFilter('confirmed')} className={statusFilter === 'confirmed' ? 'ring-2 ring-primary' : 'cursor-pointer hover:shadow-md transition-shadow'} />
        <StatsCard title="In Transit" value={stats.inTransit} icon={Truck} description="On the way" onClick={() => setStatusFilter('in_transit')} className={statusFilter === 'in_transit' ? 'ring-2 ring-primary' : 'cursor-pointer hover:shadow-md transition-shadow'} />
        <StatsCard title="Completed" value={stats.completed} icon={Package} description="Received" onClick={() => setStatusFilter('completed')} className={statusFilter === 'completed' ? 'ring-2 ring-primary' : 'cursor-pointer hover:shadow-md transition-shadow'} />
      </div>

      {/* Filters - Responsive */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by PO number..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="supplier_rejected">Rejected</SelectItem>
                <SelectItem value="in_transit">In Transit</SelectItem>
                <SelectItem value="partially_received">Partial Received</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            {statusFilter !== 'all' && <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')} className="shrink-0">
                Clear
              </Button>}
          </div>
        </CardContent>
      </Card>

      {/* PO List */}
      {isLoading ? <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div> : filteredPOs.length === 0 ? <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-medium text-lg mb-1">No Purchase Orders</h3>
            <p className="text-muted-foreground text-sm">Create your first PO to get started.</p>
          </CardContent>
        </Card> : <div className="space-y-3">
          {filteredPOs.map(po => <Card key={po.id} className="hover:shadow-md transition-shadow group">
              <CardContent className="p-4">
                {/* Mobile Layout */}
                <div className="md:hidden space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{po.po_number}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {po.suppliers?.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(po.status)}
                      {getPaymentBadge(po.payment_status)}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(po.order_date), 'MMM dd')}
                      </span>
                    </div>
                    <div className="font-semibold">
                      {currency} {po.total_amount.toLocaleString()}
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    {(po.status === 'completed' || po.status === 'partially_received') && po.payment_status !== 'paid' && !po.supplier_payment_confirmed && (profile?.role === 'super_admin' || profile?.role === 'finance') && <Button variant="outline" size="sm" onClick={() => openPaymentDialog(po)} className="flex-1 text-blue-600">
                        <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                        Pay
                      </Button>}
                    {['pending', 'draft', 'sent', 'confirmed'].includes(po.status) && <Button variant="outline" size="sm" onClick={() => setCancelDialog({
                open: true,
                po
              })} className="flex-1 text-destructive">
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Cancel
                      </Button>}
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{po.po_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          {po.suppliers?.name} → {po.outlets?.name}
                          {po.profiles && <span className="ml-2">• {po.profiles.full_name || po.profiles.email}</span>}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 text-sm pl-13">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(po.order_date), 'MMM dd, yyyy')}</span>
                      </div>
                      {po.expected_delivery_date && <div className="flex items-center gap-2 text-muted-foreground">
                          <Truck className="h-4 w-4" />
                          <span>Expected: {format(new Date(po.expected_delivery_date), 'MMM dd')}</span>
                        </div>}
                      <div className="flex items-center gap-2 font-medium">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>{currency} {po.total_amount.toLocaleString()}</span>
                      </div>
                      {po.paid_amount && po.paid_amount > 0 && <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>Paid: {currency} {po.paid_amount.toLocaleString()}</span>
                        </div>}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-2">
                      {getStatusBadge(po.status)}
                      {getPaymentBadge(po.payment_status)}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(po.status === 'completed' || po.status === 'partially_received') && po.payment_status !== 'paid' && !po.supplier_payment_confirmed && (profile?.role === 'super_admin' || profile?.role === 'finance') && <Button variant="outline" size="sm" onClick={() => openPaymentDialog(po)} className="text-blue-600 hover:text-blue-700">
                          <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                          Record Payment
                        </Button>}
                      {['pending', 'draft', 'sent', 'confirmed'].includes(po.status) && <Button variant="outline" size="sm" onClick={() => setCancelDialog({
                  open: true,
                  po
                })} className="text-destructive hover:text-destructive">
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Cancel
                        </Button>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>)}
        </div>}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialog.open} onOpenChange={open => setCancelDialog({
      ...cancelDialog,
      open
    })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Purchase Order?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel <strong>{cancelDialog.po?.po_number}</strong>?
              <br /><br />
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Mark the PO as cancelled</li>
                <li>Prevent any further receiving</li>
                <li>Notify the supplier</li>
              </ul>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep PO</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelDialog.po && cancelMutation.mutate(cancelDialog.po.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel PO'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={open => setPaymentDialog({
      ...paymentDialog,
      open
    })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">PO Number</span>
                <span className="font-medium">{paymentDialog.po?.po_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Original Total</span>
                <span className="font-medium">{currency} {paymentDialog.po?.total_amount?.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="text-sm font-medium">Suggested Payment</span>
                {loadingSuggestion ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className={`font-bold ${paymentDialog.suggestedAmount !== paymentDialog.po?.total_amount ? 'text-amber-600' : 'text-green-600'}`}>
                    {currency} {paymentDialog.suggestedAmount?.toLocaleString()}
                  </span>}
              </div>
            </div>

            {paymentDialog.suggestedAmount !== null && paymentDialog.suggestedAmount !== paymentDialog.po?.total_amount && <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                Suggested amount differs from original due to partial receiving
              </p>}

            <div>
              <Label className="text-sm font-medium">Amount Paid *</Label>
              <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter amount" className="mt-1.5" />
              {paymentDialog.suggestedAmount && !paymentAmount && <Button variant="link" size="sm" className="p-0 h-auto text-xs mt-1" onClick={() => setPaymentAmount(paymentDialog.suggestedAmount?.toString() || '')}>
                  Use suggested amount
                </Button>}
            </div>

            <div>
              <Label className="text-sm font-medium">Payment Reference</Label>
              <Input value={paymentReference} onChange={e => setPaymentReference(e.target.value)} placeholder="Transaction ID, cheque number..." className="mt-1.5" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setPaymentDialog({
            open: false,
            po: null,
            suggestedAmount: null
          })}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => paymentDialog.po && paymentMutation.mutate({
            po_id: paymentDialog.po.id,
            amount: parseFloat(paymentAmount),
            reference: paymentReference
          })} disabled={!paymentAmount || paymentMutation.isPending}>
              {paymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>;
};
export default PurchaseOrderDashboard;