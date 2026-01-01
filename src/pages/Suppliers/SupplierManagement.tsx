import { useState } from 'react';
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
import { Plus, Search, Star, Building2, Package, Trash2, Mail, CheckCircle, Loader2, AlertCircle, Phone, MapPin, User, Edit2, ChevronRight } from 'lucide-react';
import { SupplierProductsDialog } from '@/components/suppliers/SupplierProductsDialog';
import { useUserRoles } from '@/hooks/useUserRoles';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PageContainer, PageHeader, StatsCard, StatsGrid } from '@/components/layout';
import { EmptyState } from '@/components/ui/empty-state';
import { DataTableSkeleton } from '@/components/ui/data-table-skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

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
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [assignProductsDialog, setAssignProductsDialog] = useState<{ open: boolean; supplierId: string; supplierName: string }>({ open: false, supplierId: '', supplierName: '' });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; supplier: Supplier | null }>({ open: false, supplier: null });
  const [formTab, setFormTab] = useState('basic');

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
    setFormTab('basic');
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
    setFormTab('basic');
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
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive'; className: string }> = {
      active: { variant: 'default', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
      inactive: { variant: 'secondary', className: 'bg-muted text-muted-foreground' },
      blacklisted: { variant: 'destructive', className: 'bg-destructive/15 text-destructive border-destructive/20' }
    };
    const { variant, className } = config[status] || config.active;
    return <Badge variant={variant} className={className}>{status}</Badge>;
  };

  const getRatingStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            )}
          />
        ))}
        <span className="ml-1.5 text-xs font-medium text-muted-foreground">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const activeCount = suppliers.filter(s => s.status === 'active').length;
  const inactiveCount = suppliers.filter(s => s.status === 'inactive').length;
  const blacklistedCount = suppliers.filter(s => s.status === 'blacklisted').length;
  const withPortalCount = suppliers.filter(s => s.has_portal_access).length;

  return (
    <PageContainer>
      <PageHeader
        title="Supplier Management"
        description="Manage your suppliers and track their performance"
        icon={Building2}
        actions={
          permissions.canManageSuppliers ? (
            <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} size={isMobile ? 'sm' : 'default'}>
              <Plus className="mr-2 h-4 w-4" />
              {isMobile ? 'Add' : 'Add Supplier'}
            </Button>
          ) : undefined
        }
      />

      {/* Stats Cards - 2 columns on mobile, 4 on desktop */}
      {isMobile ? (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{suppliers.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-lg font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <StatsGrid columns={4}>
          <StatsCard
            title="Total Suppliers"
            value={suppliers.length}
            icon={Building2}
            description="All suppliers"
          />
          <StatsCard
            title="Active"
            value={activeCount}
            icon={CheckCircle}
            description="Currently active"
            className="border-l-4 border-l-emerald-500"
          />
          <StatsCard
            title="Portal Access"
            value={withPortalCount}
            icon={Mail}
            description="With portal access"
          />
          <StatsCard
            title="Blacklisted"
            value={blacklistedCount}
            icon={AlertCircle}
            description="Blocked suppliers"
            className={blacklistedCount > 0 ? "border-l-4 border-l-destructive" : ""}
          />
        </StatsGrid>
      )}

      {/* Filters Bar */}
      <Card className="border-border/50">
        <CardContent className={cn("py-3", isMobile && "px-3")}>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {isMobile ? (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-2 w-2 rounded-full",
                        statusFilter === 'active' && "bg-emerald-500",
                        statusFilter === 'inactive' && "bg-muted-foreground",
                        statusFilter === 'blacklisted' && "bg-destructive",
                        statusFilter === 'all' && "bg-primary"
                      )} />
                      <span className="capitalize">{statusFilter === 'all' ? 'All Status' : statusFilter}</span>
                      <span className="text-muted-foreground">
                        ({statusFilter === 'all' ? suppliers.length : 
                          statusFilter === 'active' ? activeCount : 
                          statusFilter === 'inactive' ? inactiveCount : blacklistedCount})
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      All Status ({suppliers.length})
                    </div>
                  </SelectItem>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      Active ({activeCount})
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      Inactive ({inactiveCount})
                    </div>
                  </SelectItem>
                  <SelectItem value="blacklisted">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-destructive" />
                      Blacklisted ({blacklistedCount})
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex gap-2">
                {['all', 'active', 'inactive', 'blacklisted'].map((status) => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "capitalize",
                      statusFilter === status && status === 'active' && "bg-emerald-500 hover:bg-emerald-600",
                      statusFilter === status && status === 'blacklisted' && "bg-destructive hover:bg-destructive/90"
                    )}
                  >
                    {status === 'all' ? 'All' : status}
                    {status !== 'all' && (
                      <span className="ml-1.5 text-xs opacity-70">
                        ({status === 'active' ? activeCount : status === 'inactive' ? inactiveCount : blacklistedCount})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table/List */}
      {isLoading ? (
        <DataTableSkeleton rows={5} columns={6} />
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No suppliers found"
          description={searchTerm ? "Try adjusting your search" : "Add your first supplier to get started"}
          action={
            permissions.canManageSuppliers ? {
              label: "Add Supplier",
              onClick: () => { resetForm(); setIsDialogOpen(true); }
            } : undefined
          }
        />
      ) : isMobile ? (
        // Mobile Card View - Enhanced
        <div className="space-y-3">
          {filteredSuppliers.map((supplier) => (
            <Card 
              key={supplier.id} 
              className={cn(
                "overflow-hidden transition-all active:scale-[0.99]",
                supplier.status === 'blacklisted' && "border-destructive/30 bg-destructive/5"
              )}
            >
              <CardContent className="p-0">
                {/* Header with name and status */}
                <div className="p-3 pb-2 border-b border-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{supplier.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">{supplier.code}</span>
                        {getStatusBadge(supplier.status)}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getRatingStars(supplier.rating)}
                    </div>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="p-3 py-2 space-y-1.5">
                  {supplier.contact_person && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{supplier.contact_person}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    {supplier.phone && (
                      <a href={`tel:${supplier.phone}`} className="flex items-center gap-2 text-sm text-primary">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{supplier.phone}</span>
                      </a>
                    )}
                    {supplier.city && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{supplier.city}</span>
                      </div>
                    )}
                  </div>
                  {supplier.has_portal_access && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-1 w-fit">
                      <CheckCircle className="h-3 w-3" />
                      <span>Portal Access Active</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-3 pt-2 border-t border-border/50 bg-muted/30">
                  <div className="flex gap-2">
                    {permissions.canManageSuppliers && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-9" 
                        onClick={() => handleEdit(supplier)}
                      >
                        <Edit2 className="h-4 w-4 mr-1.5" />
                        Edit
                      </Button>
                    )}
                    {hasAnyRole(['super_admin', 'super_manager']) && (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="flex-1 h-9" 
                        onClick={() => setAssignProductsDialog({ open: true, supplierId: supplier.id, supplierName: supplier.name })}
                      >
                        <Package className="h-4 w-4 mr-1.5" />
                        Products
                      </Button>
                    )}
                    {permissions.canManageSuppliers && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteDialog({ open: true, supplier })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Desktop Table View
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Supplier</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-center">Rating</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Portal</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow 
                  key={supplier.id} 
                  className={cn(
                    "group",
                    supplier.status === 'blacklisted' && "bg-destructive/5"
                  )}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{supplier.code}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      {supplier.contact_person && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          {supplier.contact_person}
                        </div>
                      )}
                      {supplier.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {supplier.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {supplier.city && (
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {supplier.city}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getRatingStars(supplier.rating)}
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatusBadge(supplier.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    {supplier.has_portal_access ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : supplier.email ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => grantAccessMutation.mutate(supplier)}
                        disabled={grantAccessMutation.isPending}
                      >
                        <Mail className="h-3 w-3 mr-1" />
                        Grant
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No email</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {permissions.canManageSuppliers && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleEdit(supplier)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {hasAnyRole(['super_admin', 'super_manager']) && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0"
                          onClick={() => setAssignProductsDialog({ open: true, supplierId: supplier.id, supplierName: supplier.name })}
                        >
                          <Package className="h-4 w-4" />
                        </Button>
                      )}
                      {supplier.has_portal_access && supplier.email && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => grantAccessMutation.mutate(supplier)}
                          disabled={grantAccessMutation.isPending}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      {permissions.canManageSuppliers && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteDialog({ open: true, supplier })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Add/Edit Supplier Sheet */}
      <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <SheetContent className={cn("overflow-y-auto", isMobile ? "w-full" : "sm:max-w-lg")}>
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </SheetTitle>
            <SheetDescription>
              {editingSupplier ? 'Update supplier information' : 'Enter supplier details to create a new supplier'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="mt-6">
            <Tabs value={formTab} onValueChange={setFormTab}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="contact">Contact</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="name">Supplier Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter supplier name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Supplier Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="SUP001"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-500" />
                          Active
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                          Inactive
                        </div>
                      </SelectItem>
                      <SelectItem value="blacklisted">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-destructive" />
                          Blacklisted
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes about this supplier..."
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="contact" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person *</Label>
                  <Input
                    id="contact_person"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    placeholder="Full name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+92..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp_number">WhatsApp *</Label>
                    <Input
                      id="whatsapp_number"
                      value={formData.whatsapp_number}
                      onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value })}
                      placeholder="+92..."
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="supplier@example.com"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Portal access credentials will be sent to this email</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="City name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address *</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full address"
                    rows={2}
                    required
                  />
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms">Payment Terms</Label>
                  <Select value={formData.payment_terms} onValueChange={(value) => setFormData({ ...formData, payment_terms: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Net 7">Net 7</SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 45">Net 45</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                      <SelectItem value="COD">Cash on Delivery</SelectItem>
                      <SelectItem value="Advance">Advance Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="lead_time_days">Lead Time (Days)</Label>
                    <Input
                      id="lead_time_days"
                      type="number"
                      min="1"
                      value={formData.lead_time_days}
                      onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) || 7 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minimum_order_value">Min Order (PKR)</Label>
                    <Input
                      id="minimum_order_value"
                      type="number"
                      min="0"
                      step="100"
                      value={formData.minimum_order_value}
                      onChange={(e) => setFormData({ ...formData, minimum_order_value: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID / NTN</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    placeholder="Optional"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3 mt-8 pt-4 border-t">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Save Supplier</>
                )}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

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
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Supplier?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  Are you sure you want to delete <strong>{deleteDialog.supplier?.name}</strong>?
                </p>
                <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                  <p className="font-medium text-foreground mb-2">This will permanently:</p>
                  <p>• Remove the supplier record</p>
                  <p>• Remove all product/packaging assignments</p>
                  <p>• Remove the supplier's portal access</p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog.supplier && deleteMutation.mutate(deleteDialog.supplier.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Supplier'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default SupplierManagement;
