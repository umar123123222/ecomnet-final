import { useState } from 'react';
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
import { Plus, Search, Star, Building2, Package, Trash2, Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { SupplierProductsDialog } from '@/components/suppliers/SupplierProductsDialog';
import { useUserRoles } from '@/hooks/useUserRoles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PageContainer, PageHeader, StatsCard, StatsGrid } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton';

interface Supplier {
  id: string;
  name: string;
  code: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  rating: number;
  status: 'active' | 'inactive' | 'blacklisted';
  created_at: string;
  has_portal_access?: boolean;
}

const SupplierManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { permissions, hasAnyRole } = useUserRoles();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [assignProductsDialog, setAssignProductsDialog] = useState<{ open: boolean; supplierId: string; supplierName: string }>({ open: false, supplierId: '', supplierName: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    payment_terms: 'Net 30',
    tax_id: '',
    status: 'active',
    notes: '',
    whatsapp_number: '',
    lead_time_days: 7,
    minimum_order_value: 0,
  });

  // Fetch suppliers with portal access info
  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ['suppliers', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('suppliers')
        .select(`
          *,
          supplier_profiles (
            user_id
          )
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data as any[]).map(s => ({
        ...s,
        has_portal_access: s.supplier_profiles && s.supplier_profiles.length > 0
      })) as Supplier[];
    }
  });

  // Create/Update supplier
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingSupplier) {
        const { error } = await supabase
          .from('suppliers')
          .update(data)
          .eq('id', editingSupplier.id);
        if (error) throw error;
        return { isNew: false, supplierId: editingSupplier.id };
      } else {
        const { data: newSupplier, error } = await supabase
          .from('suppliers')
          .insert([data])
          .select()
          .single();
        if (error) throw error;
        return { isNew: true, supplierId: newSupplier.id };
      }
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      
      // If new supplier, create portal account
      if (result.isNew && formData.email) {
        try {
          const { data: accountResult, error: accountError } = await supabase.functions.invoke('create-supplier-account', {
            body: {
              supplier_id: result.supplierId,
              email: formData.email,
              contact_person: formData.contact_person,
              supplier_name: formData.name,
            }
          });

          if (accountError) throw accountError;

          if (accountResult.success) {
            toast({
              title: 'Supplier Created',
              description: accountResult.email_sent 
                ? `Supplier ${formData.name} created and portal access sent to ${formData.email}`
                : `Supplier ${formData.name} created but failed to send credentials email. Use "Resend Portal Access" to try again.`,
            });
          } else if (accountResult.code === 'ACCOUNT_EXISTS') {
            toast({
              title: 'Supplier Created',
              description: `Supplier ${formData.name} created successfully.`,
            });
          } else {
            throw new Error(accountResult.error || 'Failed to create portal account');
          }
        } catch (error: any) {
          console.error('Portal account creation error:', error);
          toast({
            title: 'Supplier Created',
            description: `Supplier ${formData.name} created but portal account creation failed: ${error.message}`,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: 'Supplier Updated',
          description: `Supplier ${formData.name} has been updated successfully.`
        });
      }
      
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

  // Delete supplier
  const deleteMutation = useMutation({
    mutationFn: async (supplierId: string) => {
      // Check for existing NON-CANCELLED purchase orders only
      const { data: activePOs, error: poError } = await supabase
        .from('purchase_orders')
        .select('id')
        .eq('supplier_id', supplierId)
        .neq('status', 'cancelled')
        .limit(1);

      if (poError) throw poError;
      
      if (activePOs && activePOs.length > 0) {
        throw new Error('Cannot delete supplier with active purchase orders. Please cancel or complete the purchase orders first.');
      }

      // Check for existing GRNs
      const { data: grns, error: grnError } = await supabase
        .from('goods_received_notes')
        .select('id')
        .eq('supplier_id', supplierId)
        .limit(1);

      if (grnError) throw grnError;
      
      if (grns && grns.length > 0) {
        throw new Error('Cannot delete supplier with existing goods received notes. These records must be preserved for audit purposes.');
      }

      // Auto-cleanup: Delete cancelled purchase orders for this supplier
      await supabase
        .from('purchase_orders')
        .delete()
        .eq('supplier_id', supplierId)
        .eq('status', 'cancelled');

      // Delete related records
      await supabase
        .from('supplier_products')
        .delete()
        .eq('supplier_id', supplierId);

      await supabase
        .from('supplier_profiles')
        .delete()
        .eq('supplier_id', supplierId);

      await supabase
        .from('low_stock_notifications')
        .delete()
        .eq('supplier_id', supplierId);

      // Delete the supplier
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', supplierId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: 'Supplier Deleted',
        description: 'Supplier and all related records have been deleted successfully.'
      });
      setDeleteDialog({ open: false, supplier: null });
    },
    onError: (error: any) => {
      toast({
        title: 'Cannot Delete Supplier',
        description: error.message,
        variant: 'destructive'
      });
      setDeleteDialog({ open: false, supplier: null });
    }
  });

  // Grant/Resend portal access
  const grantAccessMutation = useMutation({
    mutationFn: async (supplier: Supplier) => {
      const { data, error } = await supabase.functions.invoke('create-supplier-account', {
        body: {
          supplier_id: supplier.id,
          email: supplier.email,
          contact_person: supplier.contact_person,
          supplier_name: supplier.name,
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data, supplier) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({
        title: data.email_sent ? 'Portal Access Sent' : 'Portal Access Created',
        description: data.email_sent
          ? `Portal access credentials sent to ${supplier.email}`
          : `Portal access created but failed to send email to ${supplier.email}`,
        variant: data.email_sent ? 'default' : 'destructive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to grant portal access',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      payment_terms: 'Net 30',
      tax_id: '',
      status: 'active',
      notes: '',
      whatsapp_number: '',
      lead_time_days: 7,
      minimum_order_value: 0,
    });
    setEditingSupplier(null);
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      code: supplier.code,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: '',
      city: supplier.city || '',
      payment_terms: (supplier as any).payment_terms || 'Net 30',
      tax_id: '',
      status: supplier.status,
      notes: '',
      whatsapp_number: (supplier as any).whatsapp_number || '',
      lead_time_days: (supplier as any).lead_time_days || 7,
      minimum_order_value: (supplier as any).minimum_order_value || 0,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      inactive: 'secondary',
      blacklisted: 'destructive'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getRatingStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        <span className="ml-1 text-sm text-muted-foreground">({rating.toFixed(1)})</span>
      </div>
    );
  };

  const activeCount = suppliers.filter(s => s.status === 'active').length;
  const inactiveCount = suppliers.filter(s => s.status === 'inactive').length;
  const blacklistedCount = suppliers.filter(s => s.status === 'blacklisted').length;

  return (
    <PageContainer>
      <PageHeader
        title="Supplier Management"
        description="Manage your suppliers and track their performance"
        icon={Building2}
        actions={
          permissions.canManageSuppliers ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Supplier
            </Button>
          ) : undefined
        }
      />

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Supplier Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="code">Supplier Code *</Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="SUP001"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_person">Contact Person *</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="payment_terms">Payment Terms</Label>
                    <Input
                      id="payment_terms"
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      placeholder="Net 30"
                    />
                  </div>
                  <div>
                    <Label htmlFor="whatsapp_number">WhatsApp Number *</Label>
                    <Input
                      id="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      placeholder="+92XXXXXXXXXX"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="lead_time_days">Lead Time (Days)</Label>
                    <Input
                      id="lead_time_days"
                      type="number"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="minimum_order_value">Minimum Order Value (PKR)</Label>
                    <Input
                      id="minimum_order_value"
                      type="number"
                      step="0.01"
                      value={formData.minimum_order_value}
                      onChange={(e) => setFormData({ ...formData, minimum_order_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tax_id">Tax ID</Label>
                    <Input
                      id="tax_id"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="blacklisted">Blacklisted</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <Button type="submit" disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? 'Saving...' : 'Save Supplier'}
                  </Button>
                </div>
            </form>
          </DialogContent>
        </Dialog>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search suppliers by name or code..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="blacklisted">Blacklisted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Grid */}
      {isLoading ? (
        <div className="text-center py-12">Loading suppliers...</div>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No suppliers found. Add your first supplier to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{supplier.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{supplier.code}</p>
                  </div>
                  {getStatusBadge(supplier.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {getRatingStars(supplier.rating)}
                
                {supplier.contact_person && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Contact:</span> {supplier.contact_person}
                  </div>
                )}
                
                {supplier.phone && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone:</span> {supplier.phone}
                  </div>
                )}
                
                {supplier.city && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">City:</span> {supplier.city}
                  </div>
                )}
                
                {supplier.status === 'blacklisted' && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>Blacklisted Supplier</span>
                  </div>
                )}

                {/* Portal Access Badge */}
                {supplier.has_portal_access && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Portal Access Active</span>
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-4">
                  <div className="flex gap-2">
                    {permissions.canManageSuppliers && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(supplier)}>
                        Edit
                      </Button>
                    )}
                    {hasAnyRole(['super_admin', 'super_manager']) && (
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="flex-1" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setAssignProductsDialog({ open: true, supplierId: supplier.id, supplierName: supplier.name });
                        }}
                      >
                        <Package className="mr-1 h-3 w-3" />
                        Assign
                      </Button>
                    )}
                  </div>

                  {/* Portal Access & Delete Actions */}
                  <div className="flex gap-2">
                    {permissions.canManageSuppliers && !supplier.has_portal_access && supplier.email && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => grantAccessMutation.mutate(supplier)}
                        disabled={grantAccessMutation.isPending}
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        Grant Portal Access
                      </Button>
                    )}
                    {permissions.canManageSuppliers && supplier.has_portal_access && supplier.email && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => grantAccessMutation.mutate(supplier)}
                        disabled={grantAccessMutation.isPending}
                      >
                        <Mail className="mr-1 h-3 w-3" />
                        Resend Portal Access
                      </Button>
                    )}
                    {permissions.canManageSuppliers && (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => setDeleteDialog({ open: true, supplier })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SupplierProductsDialog
        open={assignProductsDialog.open}
        onOpenChange={(open) => setAssignProductsDialog({ ...assignProductsDialog, open })}
        supplierId={assignProductsDialog.supplierId}
        supplierName={assignProductsDialog.supplierName}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.supplier?.name}</strong>? This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Remove the supplier record</li>
                <li>Remove all product/packaging assignments</li>
                <li>Remove the supplier's portal access (if exists)</li>
                <li>This action cannot be undone</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.supplier && deleteMutation.mutate(deleteDialog.supplier.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Supplier'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default SupplierManagement;
