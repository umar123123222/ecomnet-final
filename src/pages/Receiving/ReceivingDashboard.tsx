import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, Package, AlertTriangle, CheckCircle2, ScanBarcode, Upload, X, ImageIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import UnifiedScanner from '@/components/UnifiedScanner';
import type { ScanResult } from '@/components/UnifiedScanner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isReceivingDialogOpen, setIsReceivingDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);
  const [notes, setNotes] = useState('');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  
  // Scanner states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [currentScanningItemIndex, setCurrentScanningItemIndex] = useState<number | null>(null);
  const [scannedItemsCount, setScannedItemsCount] = useState<Record<number, number>>({});
  const [continuousScanMode, setContinuousScanMode] = useState(false);

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
  const { data: pendingPOs = [] } = useQuery({
    queryKey: ['pending-pos'],
    queryFn: async () => {
      const { data, error } = await supabase
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
        .in('status', ['sent', 'confirmed', 'in_transit', 'partially_received'])
        .order('expected_delivery_date', { ascending: true });
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
        unit_cost: item.unit_cost,
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
          // Try creating the bucket if it doesn't exist
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
    newItems[index][field] = value;
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
    // Extract SKU from rawData
    const scannedSKU = result.rawData.trim();
    
    // Find matching item in receivingItems by SKU
    const matchedIndex = receivingItems.findIndex(
      item => item.sku.toLowerCase() === scannedSKU.toLowerCase()
    );
    
    if (matchedIndex !== -1) {
      // Increment received quantity
      const newItems = [...receivingItems];
      newItems[matchedIndex].quantity_received += 1;
      setReceivingItems(newItems);
      
      // Track scan count
      setScannedItemsCount(prev => ({
        ...prev,
        [matchedIndex]: (prev[matchedIndex] || 0) + 1
      }));
      
      // Check for over-receiving
      if (newItems[matchedIndex].quantity_received > newItems[matchedIndex].quantity_expected) {
        toast({
          title: 'Warning: Over-Receiving',
          description: `Received quantity (${newItems[matchedIndex].quantity_received}) exceeds expected (${newItems[matchedIndex].quantity_expected})`,
          duration: 4000
        });
      } else {
        // Success toast
        toast({
          title: 'Item Scanned',
          description: `${newItems[matchedIndex].name} - Quantity: ${newItems[matchedIndex].quantity_received}`,
          duration: 2000
        });
      }
      
      // Auto-close if not in continuous mode
      if (!continuousScanMode) {
        setIsScannerOpen(false);
        setCurrentScanningItemIndex(null);
      }
    } else {
      // No match found
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
      // Validate - items with discrepancy must have notes or damage reason
      const discrepancyWithoutReason = receivingItems.some(
        item => item.quantity_received < item.quantity_expected && 
                !item.damage_reason && 
                !item.notes
      );
      
      if (discrepancyWithoutReason) {
        throw new Error('Please provide a reason for items with quantity discrepancies');
      }

      // Validate - damaged, wrong_item, or defective must have images
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
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending_inspection: { variant: 'secondary', label: 'Pending Inspection' },
      inspected: { variant: 'outline', label: 'Inspected' },
      accepted: { variant: 'default', label: 'Accepted' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      partial_accept: { variant: 'outline', label: 'Partial Accept' }
    };
    const config = variants[status] || variants.pending_inspection;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredGRNs = grns.filter(grn =>
    grn.grn_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    pending: grns.filter(g => g.status === 'pending_inspection').length,
    accepted: grns.filter(g => g.status === 'accepted').length,
    withDiscrepancy: grns.filter(g => g.discrepancy_flag).length,
    rejected: grns.filter(g => g.status === 'rejected').length
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Goods Receiving</h1>
          <p className="text-muted-foreground">Receive and inspect incoming shipments</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Inspection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.accepted}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">With Discrepancy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.withDiscrepancy}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pending POs for Receiving */}
      {pendingPOs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendingPOs.map((po: any) => (
                <div key={po.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{po.po_number}</p>
                        {po.status === 'in_transit' && (
                          <Badge className="bg-blue-500">Shipped</Badge>
                        )}
                        {po.status === 'confirmed' && (
                          <Badge variant="secondary">Confirmed</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {po.suppliers?.name} → {po.outlets?.name}
                      </p>
                      {po.shipping_tracking && (
                        <p className="text-xs text-muted-foreground">
                          Tracking: {po.shipping_tracking}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => startReceiving(po)}>
                    Start Receiving
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by GRN number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

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
        <div className="space-y-4">
          {filteredGRNs.map((grn) => (
            <Card key={grn.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{grn.grn_number}</h3>
                        <p className="text-sm text-muted-foreground">
                          PO: {grn.purchase_orders?.po_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {grn.suppliers?.name} → {grn.outlets?.name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-muted-foreground">Received:</span>{' '}
                        {format(new Date(grn.received_date), 'MMM dd, yyyy')}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Items:</span>{' '}
                        {grn.total_items_received} / {grn.total_items_expected}
                      </div>
                      {grn.discrepancy_flag && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Discrepancy</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(grn.status)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Receiving Dialog */}
      <Dialog open={isReceivingDialogOpen} onOpenChange={(open) => {
        setIsReceivingDialogOpen(open);
        if (!open) {
          setSelectedPO(null);
          setReceivingItems([]);
          setNotes('');
          setScannedItemsCount({});
          setIsScannerOpen(false);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Receive Goods - {selectedPO?.po_number}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              From: {selectedPO?.suppliers?.name} → To: {selectedPO?.outlets?.name}
            </p>
          </DialogHeader>

          <div className="space-y-6">
            {/* Warehouse Info */}
            {mainWarehouse && (
              <div>
                <Label>Receiving Warehouse</Label>
                <Input 
                  value={mainWarehouse.name} 
                  disabled 
                  className="bg-muted"
                />
              </div>
            )}

            {/* Items to Receive */}
            {receivingItems.length > 0 ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Items to Receive</h3>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {receivingItems.length} item(s)
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={startContinuousScanning}
                    >
                      <ScanBarcode className="h-4 w-4 mr-2" />
                      Scan Items
                    </Button>
                  </div>
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
                        <CardContent className="pt-4 space-y-4">
                          {/* Item Header */}
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {hasDiscrepancy && (
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                              )}
                              {isScanned && !hasDiscrepancy && (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              )}
                              <div>
                                <p className="font-medium">{item.name}</p>
                                <p className="text-sm text-muted-foreground">{item.sku}</p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openScannerForItem(index)}
                              title="Scan barcode"
                            >
                              <ScanBarcode className="h-4 w-4" />
                            </Button>
                          </div>

                          {/* Quantity Row */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">Expected</Label>
                              <div className="font-semibold text-lg">{item.quantity_expected}</div>
                            </div>
                            <div>
                              <Label className="text-xs">Received Qty *</Label>
                              <Input
                                type="number"
                                min="0"
                                value={item.quantity_received}
                                onChange={(e) => updateReceivedQuantity(index, e.target.value)}
                                className={hasDiscrepancy ? 'border-amber-500' : ''}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Batch #</Label>
                              <Input
                                placeholder="Optional"
                                value={item.batch_number}
                                onChange={(e) => updateItemField(index, 'batch_number', e.target.value)}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Expiry Date</Label>
                              <Input
                                type="date"
                                value={item.expiry_date}
                                onChange={(e) => updateItemField(index, 'expiry_date', e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Discrepancy Section - Only show when quantity is less */}
                          {hasDiscrepancy && (
                            <div className="border-t pt-4 space-y-3">
                              <div className="flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-sm font-medium">
                                  Missing {item.quantity_expected - item.quantity_received} item(s) - Please provide reason
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-xs">Reason for Discrepancy *</Label>
                                  <Select
                                    value={item.damage_reason}
                                    onValueChange={(value) => updateItemField(index, 'damage_reason', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select reason" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="damaged">Damaged Items</SelectItem>
                                      <SelectItem value="missing">Missing from Shipment</SelectItem>
                                      <SelectItem value="wrong_item">Wrong Item Received</SelectItem>
                                      <SelectItem value="defective">Defective/Quality Issue</SelectItem>
                                      <SelectItem value="short_shipment">Short Shipment</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label className="text-xs">Notes</Label>
                                  <Input
                                    placeholder="Additional details..."
                                    value={item.notes}
                                    onChange={(e) => updateItemField(index, 'notes', e.target.value)}
                                  />
                                </div>
                              </div>

                              {/* Image Upload for Damage Proof */}
                              {(item.damage_reason === 'damaged' || item.damage_reason === 'defective' || item.damage_reason === 'wrong_item') && (
                                <div className="space-y-2">
                                  <Label className="text-xs flex items-center gap-1">
                                    Upload Proof Images <span className="text-destructive">*</span>
                                    {item.damage_images.length === 0 && (
                                      <span className="text-destructive text-xs">(Required)</span>
                                    )}
                                  </Label>
                                  <div className="flex flex-wrap gap-2">
                                    {item.damage_images.map((img, imgIndex) => (
                                      <div key={imgIndex} className="relative group">
                                        <img 
                                          src={img} 
                                          alt={`Damage proof ${imgIndex + 1}`}
                                          className="w-16 h-16 object-cover rounded border"
                                        />
                                        <button
                                          onClick={() => removeImage(index, imgIndex)}
                                          className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => fileInputRefs.current[index]?.click()}
                                      disabled={uploadingIndex === index}
                                      className={`w-16 h-16 border-2 border-dashed rounded flex items-center justify-center transition-colors ${
                                        item.damage_images.length === 0 
                                          ? 'border-destructive text-destructive hover:bg-destructive/10' 
                                          : 'text-muted-foreground hover:border-primary hover:text-primary'
                                      }`}
                                    >
                                      {uploadingIndex === index ? (
                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                      ) : (
                                        <Upload className="h-5 w-5" />
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
                                  <p className="text-xs text-muted-foreground">
                                    Upload photos as proof of damage/issue (max 5MB each) - Required
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Discrepancy Summary Warning */}
                {receivingItems.some(item => item.quantity_received < item.quantity_expected) && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900">Quantity Discrepancy Detected</h4>
                      <p className="text-sm text-amber-800 mt-1">
                        Items with quantity differences will be flagged. Managers and the supplier will be automatically notified.
                      </p>
                    </div>
                  </div>
                )}

                {/* General Notes */}
                <div>
                  <Label>General Notes</Label>
                  <Textarea
                    placeholder="Add any additional notes about this receiving..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsReceivingDialogOpen(false);
                      setSelectedPO(null);
                      setReceivingItems([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createGRNMutation.mutate()}
                    disabled={createGRNMutation.isPending || receivingItems.length === 0}
                  >
                    {createGRNMutation.isPending ? 'Creating GRN...' : 'Complete Receiving'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-4" />
                <p>Loading items...</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
    </div>
  );
};

export default ReceivingDashboard;
