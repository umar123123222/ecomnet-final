import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, Package, AlertTriangle, CheckCircle2, ScanBarcode, Upload, X, Eye, ClipboardCheck, Truck, Clock, XCircle, ArrowRight, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { format } from 'date-fns';
import UnifiedScanner from '@/components/UnifiedScanner';
import type { ScanResult } from '@/components/UnifiedScanner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GRNDetailsDialog from '@/components/receiving/GRNDetailsDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { StatsCard } from '@/components/layout';

interface GRN {
  id: string;
  grn_number: string;
  status: string;
  received_date: string;
  total_items_expected: number;
  total_items_received: number;
  discrepancy_flag: boolean;
  suppliers: { name: string } | null;
  outlets: { name: string } | null;
  purchase_orders: { po_number: string } | null;
}

interface ReceivingItem {
  po_item_id: string;
  product_id: string | null;
  packaging_item_id: string | null;
  name: string;
  sku: string;
  quantity_expected: number;
  quantity_received: number;
  unit_cost: number;
  batch_number: string;
  expiry_date: string;
  notes: string;
  damage_reason: string;
  damage_images: string[];
}

const ReceivingDashboard = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { hasAnyRole } = useUserRoles();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isReceivingDialogOpen, setIsReceivingDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);
  const [notes, setNotes] = useState('');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  
  // GRN Details dialog state
  const [selectedGRNId, setSelectedGRNId] = useState<string | null>(null);
  const [isGRNDetailsOpen, setIsGRNDetailsOpen] = useState(false);
  
  // Scanner states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentScanningItemIndex, setCurrentScanningItemIndex] = useState<number | null>(null);
  const [scannedItemsCount, setScannedItemsCount] = useState<Record<number, number>>({});
  const [continuousScanMode, setContinuousScanMode] = useState(false);
  
  const canResolve = hasAnyRole(['super_admin', 'super_manager']);

  // Fetch GRNs
  const { data: grns = [], isLoading } = useQuery({
    queryKey: ['grns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('goods_received_notes')
        .select(`
          *,
          suppliers(name),
          outlets(name),
          purchase_orders(po_number)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as GRN[];
    }
  });

  // Fetch pending POs for receiving
  const { data: pendingPOs = [], isLoading: isPendingPOsLoading } = useQuery({
    queryKey: ['pending-pos-receiving'],
    queryFn: async () => {
      const { data: allPOs, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          id,
          po_number,
          status,
          shipped_at,
          shipping_tracking,
          suppliers(name),
          outlets(name)
        `)
        .in('status', ['in_transit', 'partially_received'])
        .order('expected_delivery_date', { ascending: true });
      
      if (poError) throw poError;
      if (!allPOs?.length) return [];

      const { data: existingGRNs, error: grnError } = await supabase
        .from('goods_received_notes')
        .select('po_id')
        .in('status', ['pending_inspection', 'inspected', 'accepted', 'partial_accept', 'rejected']);

      if (grnError) throw grnError;

      const grnPoIds = new Set(existingGRNs?.map(g => g.po_id) || []);
      return allPOs.filter(po => !grnPoIds.has(po.id));
    },
    staleTime: 0,
    refetchOnMount: 'always'
  });

  // Fetch main warehouse
  const { data: mainWarehouse } = useQuery({
    queryKey: ['main-warehouse'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .eq('outlet_type', 'warehouse')
        .eq('is_active', true)
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Fetch PO items for selected PO
  const { data: poItems = [] } = useQuery({
    queryKey: ['po-items', selectedPO?.id],
    queryFn: async () => {
      if (!selectedPO?.id) return [];
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select(`
          *,
          products(id, name, sku),
          packaging_items(id, name, sku)
        `)
        .eq('po_id', selectedPO.id);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedPO?.id
  });

  const startReceiving = (po: any) => {
    setSelectedPO(po);
    setIsReceivingDialogOpen(true);
    setNotes('');
  };

  // Initialize receiving items when PO items are loaded
  const initializeReceivingItems = () => {
    if (poItems.length > 0 && receivingItems.length === 0) {
      const items: ReceivingItem[] = poItems.map((item: any) => ({
        po_item_id: item.id,
        product_id: item.product_id,
        packaging_item_id: item.packaging_item_id,
        name: item.products?.name || item.packaging_items?.name || 'Unknown',
        sku: item.products?.sku || item.packaging_items?.sku || '',
        quantity_expected: item.quantity_ordered - (item.quantity_received || 0),
        quantity_received: item.quantity_ordered - (item.quantity_received || 0),
        unit_cost: item.unit_price || 0,
        batch_number: '',
        expiry_date: '',
        notes: '',
        damage_reason: '',
        damage_images: []
      }));
      setReceivingItems(items);
    }
  };

  // Handle image upload for damaged items
  const handleImageUpload = async (index: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setUploadingIndex(index);
    const newImages: string[] = [];
    
    try {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: 'File too large',
            description: 'Max file size is 5MB',
            variant: 'destructive'
          });
          continue;
        }
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `grn-damage-proofs/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('grn-damage-proofs')
          .upload(filePath, file);
        
        if (uploadError) {
          if (uploadError.message.includes('not found')) {
            toast({
              title: 'Upload Error',
              description: 'Storage bucket not configured. Contact admin.',
              variant: 'destructive'
            });
            continue;
          }
          throw uploadError;
        }
        
        const { data: publicUrl } = supabase.storage
          .from('grn-damage-proofs')
          .getPublicUrl(filePath);
        
        newImages.push(publicUrl.publicUrl);
      }
      
      if (newImages.length > 0) {
        const newItems = [...receivingItems];
        newItems[index].damage_images = [...newItems[index].damage_images, ...newImages];
        setReceivingItems(newItems);
        
        toast({
          title: 'Images Uploaded',
          description: `${newImages.length} image(s) uploaded successfully`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setUploadingIndex(null);
    }
  };

  const removeImage = (itemIndex: number, imageIndex: number) => {
    const newItems = [...receivingItems];
    newItems[itemIndex].damage_images.splice(imageIndex, 1);
    setReceivingItems(newItems);
  };

  // Update received quantity
  const updateReceivedQuantity = (index: number, value: string) => {
    const newItems = [...receivingItems];
    newItems[index].quantity_received = parseInt(value) || 0;
    setReceivingItems(newItems);
  };

  const updateItemField = (index: number, field: string, value: string) => {
    const newItems = [...receivingItems];
    (newItems[index] as any)[field] = value;
    setReceivingItems(newItems);
  };

  // Scanner functions
  const openScannerForItem = (itemIndex: number) => {
    setCurrentScanningItemIndex(itemIndex);
    setContinuousScanMode(false);
    setIsScannerOpen(true);
  };

  const startContinuousScanning = () => {
    setContinuousScanMode(true);
    setCurrentScanningItemIndex(null);
    setIsScannerOpen(true);
  };

  const handleScanResult = (result: ScanResult) => {
    const scannedSKU = result.rawData.trim();
    
    const matchedIndex = receivingItems.findIndex(
      item => item.sku.toLowerCase() === scannedSKU.toLowerCase()
    );
    
    if (matchedIndex !== -1) {
      const newItems = [...receivingItems];
      newItems[matchedIndex].quantity_received += 1;
      setReceivingItems(newItems);
      
      setScannedItemsCount(prev => ({
        ...prev,
        [matchedIndex]: (prev[matchedIndex] || 0) + 1
      }));
      
      if (newItems[matchedIndex].quantity_received > newItems[matchedIndex].quantity_expected) {
        toast({
          title: 'Warning: Over-Receiving',
          description: `Received quantity (${newItems[matchedIndex].quantity_received}) exceeds expected (${newItems[matchedIndex].quantity_expected})`,
          duration: 4000
        });
      } else {
        toast({
          title: 'Item Scanned',
          description: `${newItems[matchedIndex].name} - Quantity: ${newItems[matchedIndex].quantity_received}`,
          duration: 2000
        });
      }
      
      if (!continuousScanMode) {
        setIsScannerOpen(false);
        setCurrentScanningItemIndex(null);
      }
    } else {
      toast({
        title: 'Item Not Found',
        description: `SKU "${scannedSKU}" not found in this PO`,
        variant: 'destructive',
        duration: 3000
      });
    }
  };

  // Create GRN mutation
  const createGRNMutation = useMutation({
    mutationFn: async () => {
      const discrepancyWithoutReason = receivingItems.some(
        item => item.quantity_received < item.quantity_expected && 
                !item.damage_reason && 
                !item.notes
      );
      
      if (discrepancyWithoutReason) {
        throw new Error('Please provide a reason for items with quantity discrepancies');
      }

      const requiresImageButMissing = receivingItems.some(
        item => ['damaged', 'wrong_item', 'defective'].includes(item.damage_reason) && 
                item.damage_images.length === 0
      );
      
      if (requiresImageButMissing) {
        throw new Error('Please upload proof images for damaged, wrong item, or quality issue items');
      }

      const { data, error } = await supabase.functions.invoke('process-grn', {
        body: {
          action: 'create',
          data: {
            po_id: selectedPO.id,
            items: receivingItems,
            notes
          }
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['pending-pos'] });
      queryClient.invalidateQueries({ queryKey: ['pending-pos-receiving'] });
      setIsReceivingDialogOpen(false);
      setSelectedPO(null);
      setReceivingItems([]);
      setScannedItemsCount({});
      
      if (data.hasDiscrepancy) {
        toast({
          title: 'GRN Created with Discrepancies',
          description: 'Managers and supplier have been notified about quantity differences.',
          variant: 'default'
        });
      } else {
        toast({
          title: 'Success',
          description: 'Goods received successfully',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Initialize items when dialog opens
  if (isReceivingDialogOpen && poItems.length > 0 && receivingItems.length === 0) {
    initializeReceivingItems();
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, className?: string }> = {
      pending_inspection: { variant: 'secondary', label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
      inspected: { variant: 'outline', label: 'Inspected' },
      accepted: { variant: 'default', label: 'Accepted', className: 'bg-green-100 text-green-700 border-green-200' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      partial_accept: { variant: 'outline', label: 'Partial', className: 'bg-blue-100 text-blue-700 border-blue-200' }
    };
    const config = variants[status] || variants.pending_inspection;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const filteredGRNs = grns.filter(grn => {
    const matchesSearch = grn.grn_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || grn.status === statusFilter || 
      (statusFilter === 'discrepancy' && grn.discrepancy_flag);
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending: grns.filter(g => g.status === 'pending_inspection').length,
    accepted: grns.filter(g => g.status === 'accepted').length,
    withDiscrepancy: grns.filter(g => g.discrepancy_flag).length,
    rejected: grns.filter(g => g.status === 'rejected').length
  };

  return (
    <div className="container mx-auto py-4 md:py-6 px-4 md:px-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Goods Receiving</h1>
          <p className="text-sm md:text-base text-muted-foreground">Receive and inspect incoming shipments</p>
        </div>
      </div>

      {/* Stats - Mobile: 2 columns, Desktop: 4 columns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatsCard
          title="Pending"
          value={stats.pending}
          icon={Clock}
          onClick={() => setStatusFilter(statusFilter === 'pending_inspection' ? 'all' : 'pending_inspection')}
          className={statusFilter === 'pending_inspection' ? 'ring-2 ring-primary' : ''}
        />
        <StatsCard
          title="Accepted"
          value={stats.accepted}
          icon={CheckCircle2}
          variant="success"
          onClick={() => setStatusFilter(statusFilter === 'accepted' ? 'all' : 'accepted')}
          className={statusFilter === 'accepted' ? 'ring-2 ring-primary' : ''}
        />
        <StatsCard
          title="Discrepancy"
          value={stats.withDiscrepancy}
          icon={AlertTriangle}
          variant="warning"
          onClick={() => setStatusFilter(statusFilter === 'discrepancy' ? 'all' : 'discrepancy')}
          className={statusFilter === 'discrepancy' ? 'ring-2 ring-primary' : ''}
        />
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          variant="danger"
          onClick={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
          className={statusFilter === 'rejected' ? 'ring-2 ring-primary' : ''}
        />
      </div>

      {/* Pending POs for Receiving */}
      {pendingPOs.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base md:text-lg">Ready to Receive ({pendingPOs.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {isPendingPOsLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : (
              <div className="space-y-2">
                {pendingPOs.map((po: any) => (
                  <div 
                    key={po.id} 
                    className="flex items-center justify-between p-3 bg-background rounded-lg border hover:shadow-sm transition-all active:scale-[0.99]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm md:text-base">{po.po_number}</span>
                        {po.status === 'in_transit' && (
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs">Shipped</Badge>
                        )}
                        {po.status === 'partially_received' && (
                          <Badge variant="secondary" className="text-xs">Partial</Badge>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-muted-foreground truncate">
                        {po.suppliers?.name}
                        <ArrowRight className="inline h-3 w-3 mx-1" />
                        {po.outlets?.name}
                      </p>
                      {po.shipping_tracking && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Tracking: {po.shipping_tracking}
                        </p>
                      )}
                    </div>
                    <Button 
                      size={isMobile ? "sm" : "default"}
                      onClick={() => startReceiving(po)}
                      className="ml-2 shrink-0"
                    >
                      {isMobile ? 'Receive' : 'Start Receiving'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search GRN number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        {isMobile && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending_inspection">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="partial_accept">Partial</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="discrepancy">Has Discrepancy</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* GRN List */}
      {isLoading ? (
        <div className="text-center py-12">Loading receiving records...</div>
      ) : filteredGRNs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No receiving records found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredGRNs.map((grn) => (
            <Card 
              key={grn.id} 
              className="hover:shadow-md transition-all cursor-pointer active:scale-[0.995]"
              onClick={() => {
                setSelectedGRNId(grn.id);
                setIsGRNDetailsOpen(true);
              }}
            >
              <CardContent className="p-4">
                {/* Mobile Layout */}
                {isMobile ? (
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <ClipboardCheck className="h-5 w-5 text-primary shrink-0" />
                        <div>
                          <p className="font-semibold">{grn.grn_number}</p>
                          <p className="text-xs text-muted-foreground">
                            PO: {grn.purchase_orders?.po_number}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {grn.discrepancy_flag && (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        {getStatusBadge(grn.status)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate max-w-[60%]">
                        {grn.suppliers?.name}
                      </span>
                      <span className="text-muted-foreground">
                        {grn.total_items_received}/{grn.total_items_expected} items
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(grn.received_date), 'MMM dd, yyyy')}
                      </span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ) : (
                  /* Desktop Layout */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <ClipboardCheck className="h-6 w-6 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-lg">{grn.grn_number}</h3>
                          {getStatusBadge(grn.status)}
                          {grn.discrepancy_flag && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Discrepancy
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          PO: {grn.purchase_orders?.po_number} • {grn.suppliers?.name} → {grn.outlets?.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-right">
                        <p className="text-muted-foreground">Received</p>
                        <p className="font-medium">{format(new Date(grn.received_date), 'MMM dd, yyyy')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground">Items</p>
                        <p className="font-medium">{grn.total_items_received}/{grn.total_items_expected}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGRNId(grn.id);
                          setIsGRNDetailsOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Receiving Sheet */}
      <Sheet open={isReceivingDialogOpen} onOpenChange={(open) => {
        setIsReceivingDialogOpen(open);
        if (!open) {
          setSelectedPO(null);
          setReceivingItems([]);
          setNotes('');
          setScannedItemsCount({});
          setIsScannerOpen(false);
        }
      }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Receive Goods
            </SheetTitle>
            <SheetDescription>
              {selectedPO?.po_number} • {selectedPO?.suppliers?.name} → {selectedPO?.outlets?.name}
            </SheetDescription>
          </SheetHeader>

          <div className="py-4 space-y-4">
            {/* Transfer Route Visual */}
            <div className="flex items-center justify-center gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">From</p>
                <p className="font-medium text-sm">{selectedPO?.suppliers?.name || 'Supplier'}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground">To</p>
                <p className="font-medium text-sm">{mainWarehouse?.name || 'Warehouse'}</p>
              </div>
            </div>

            {/* Items to Receive */}
            {receivingItems.length > 0 ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Items</h3>
                    <Badge variant="outline">{receivingItems.length}</Badge>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={startContinuousScanning}
                  >
                    <ScanBarcode className="h-4 w-4 mr-2" />
                    Scan
                  </Button>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                  {receivingItems.map((item, index) => {
                    const hasDiscrepancy = item.quantity_received < item.quantity_expected;
                    const isScanned = scannedItemsCount[index] > 0;
                    
                    return (
                      <Card 
                        key={index} 
                        className={
                          hasDiscrepancy 
                            ? 'border-amber-300 bg-amber-50/50' 
                            : isScanned 
                            ? 'border-green-300 bg-green-50/50'
                            : ''
                        }
                      >
                        <CardContent className="p-3 space-y-3">
                          {/* Item Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {hasDiscrepancy && (
                                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                              )}
                              {isScanned && !hasDiscrepancy && (
                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{item.name}</p>
                                <p className="text-xs text-muted-foreground">{item.sku}</p>
                              </div>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => openScannerForItem(index)}
                            >
                              <ScanBarcode className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Quantity Row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <span className="text-xs text-muted-foreground">Expected</span>
                              <span className="font-semibold">{item.quantity_expected}</span>
                            </div>
                            <div>
                              <Input
                                type="number"
                                min="0"
                                value={item.quantity_received}
                                onChange={(e) => updateReceivedQuantity(index, e.target.value)}
                                className={`h-9 text-center font-medium ${hasDiscrepancy ? 'border-amber-500' : ''}`}
                              />
                            </div>
                          </div>

                          {/* Optional Fields (Collapsed on Mobile) */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Batch #</Label>
                              <Input
                                placeholder="Optional"
                                value={item.batch_number}
                                onChange={(e) => updateItemField(index, 'batch_number', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Expiry</Label>
                              <Input
                                type="date"
                                value={item.expiry_date}
                                onChange={(e) => updateItemField(index, 'expiry_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>

                          {/* Discrepancy Section */}
                          {hasDiscrepancy && (
                            <div className="border-t pt-3 space-y-3">
                              <div className="flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-medium">
                                  Missing {item.quantity_expected - item.quantity_received} item(s)
                                </span>
                              </div>
                              
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs">Reason *</Label>
                                  <Select
                                    value={item.damage_reason}
                                    onValueChange={(value) => updateItemField(index, 'damage_reason', value)}
                                  >
                                    <SelectTrigger className="h-9">
                                      <SelectValue placeholder="Select reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="damaged">Damaged</SelectItem>
                                      <SelectItem value="missing">Missing</SelectItem>
                                      <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                      <SelectItem value="defective">Quality Issue</SelectItem>
                                      <SelectItem value="short_shipment">Short Shipment</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Notes</Label>
                                  <Input
                                    placeholder="Details..."
                                    value={item.notes}
                                    onChange={(e) => updateItemField(index, 'notes', e.target.value)}
                                    className="h-9"
                                  />
                                </div>
                              </div>

                              {/* Image Upload */}
                              {['damaged', 'defective', 'wrong_item'].includes(item.damage_reason) && (
                                <div className="space-y-2">
                                  <Label className="text-xs flex items-center gap-1">
                                    Proof Images <span className="text-destructive">*</span>
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {item.damage_images.map((img, imgIndex) => (
                                      <div key={imgIndex} className="relative group">
                                        <img 
                                          src={img} 
                                          alt={`Proof ${imgIndex + 1}`}
                                          className="w-14 h-14 object-cover rounded border"
                                        />
                                        <button
                                          onClick={() => removeImage(index, imgIndex)}
                                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => fileInputRefs.current[index]?.click()}
                                      disabled={uploadingIndex === index}
                                      className={`w-14 h-14 border-2 border-dashed rounded flex items-center justify-center transition-colors ${
                                        item.damage_images.length === 0 
                                          ? 'border-destructive text-destructive' 
                                          : 'border-muted-foreground/30 text-muted-foreground'
                                      }`}
                                    >
                                      {uploadingIndex === index ? (
                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                      ) : (
                                        <Upload className="h-4 w-4" />
                                      )}
                                    </button>
                                    <input
                                      type="file"
                                      ref={(el) => (fileInputRefs.current[index] = el)}
                                      accept="image/*"
                                      multiple
                                      className="hidden"
                                      onChange={(e) => handleImageUpload(index, e.target.files)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Discrepancy Warning */}
                {receivingItems.some(item => item.quantity_received < item.quantity_expected) && (
                  <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Discrepancy Detected</p>
                      <p className="text-xs text-amber-800">Managers will be notified.</p>
                    </div>
                  </div>
                )}

                {/* General Notes */}
                <div>
                  <Label className="text-sm">General Notes</Label>
                  <Textarea
                    placeholder="Additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="mx-auto h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">Loading items...</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-background pb-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsReceivingDialogOpen(false);
                setSelectedPO(null);
                setReceivingItems([]);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => createGRNMutation.mutate()}
              disabled={createGRNMutation.isPending || receivingItems.length === 0}
            >
              {createGRNMutation.isPending ? 'Creating...' : 'Complete'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Scanner Dialog */}
      <UnifiedScanner
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setContinuousScanMode(false);
          setCurrentScanningItemIndex(null);
        }}
        onScan={handleScanResult}
        scanType="receiving"
        title={
          currentScanningItemIndex !== null
            ? `Scan: ${receivingItems[currentScanningItemIndex]?.name}`
            : 'Scan Items'
        }
      />

      {/* GRN Details Dialog */}
      <GRNDetailsDialog
        isOpen={isGRNDetailsOpen}
        onClose={() => {
          setIsGRNDetailsOpen(false);
          setSelectedGRNId(null);
        }}
        grnId={selectedGRNId}
      />
    </div>
  );
};

export default ReceivingDashboard;
