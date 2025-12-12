import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Search, Package, AlertTriangle, CheckCircle2, ScanBarcode } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import UnifiedScanner from '@/components/UnifiedScanner';
import type { ScanResult } from '@/components/UnifiedScanner';

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

const ReceivingDashboard = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isReceivingDialogOpen, setIsReceivingDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [receivingItems, setReceivingItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  
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
      const items = poItems.map((item: any) => ({
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
        notes: ''
      }));
      setReceivingItems(items);
    }
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
      // Validate at least one item received
      const totalReceived = receivingItems.reduce((sum, item) => sum + item.quantity_received, 0);
      
      if (totalReceived === 0) {
        throw new Error('Please scan or enter at least one item before completing');
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
                {/* Header with scanning controls */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Items to Receive</h3>
                  <div className="flex gap-2">
                    <Badge variant="outline">
                      {receivingItems.length} item(s)
                    </Badge>
                    <Badge variant="secondary">
                      Scanned: {Object.values(scannedItemsCount).reduce((a, b) => a + b, 0)} / 
                      {receivingItems.reduce((sum, item) => sum + item.quantity_expected, 0)}
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={startContinuousScanning}
                    >
                      <ScanBarcode className="h-4 w-4 mr-2" />
                      Start Scanning
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Scanning Progress</span>
                    <span className="text-muted-foreground">
                      {Object.values(scannedItemsCount).reduce((a, b) => a + b, 0)} / 
                      {receivingItems.reduce((sum, item) => sum + item.quantity_expected, 0)} items
                    </span>
                  </div>
                  <Progress 
                    value={
                      receivingItems.reduce((sum, item) => sum + item.quantity_expected, 0) > 0
                        ? (Object.values(scannedItemsCount).reduce((a, b) => a + b, 0) / 
                          receivingItems.reduce((sum, item) => sum + item.quantity_expected, 0)) * 100
                        : 0
                    } 
                  />
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium">Item</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">SKU</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Expected</th>
                          <th className="px-4 py-3 text-right text-sm font-medium">Received *</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Batch #</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Expiry</th>
                          <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {receivingItems.map((item, index) => {
                          const hasDiscrepancy = item.quantity_received !== item.quantity_expected;
                          const isScanned = scannedItemsCount[index] > 0;
                          return (
                            <tr 
                              key={index} 
                              className={
                                isScanned 
                                  ? 'bg-green-50 border-l-4 border-green-500' 
                                  : hasDiscrepancy 
                                  ? 'bg-amber-50' 
                                  : ''
                              }
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {hasDiscrepancy && (
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                  )}
                                  <span className="font-medium">{item.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {item.sku}
                              </td>
                              <td className="px-4 py-3 text-right font-medium">
                                {item.quantity_expected}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={item.quantity_received}
                                    onChange={(e) => updateReceivedQuantity(index, e.target.value)}
                                    className={hasDiscrepancy ? 'border-amber-500' : ''}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openScannerForItem(index)}
                                    title="Scan barcode"
                                  >
                                    <ScanBarcode className="h-4 w-4" />
                                  </Button>
                                  {isScanned && (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  placeholder="Batch"
                                  value={item.batch_number}
                                  onChange={(e) => updateItemField(index, 'batch_number', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  type="date"
                                  value={item.expiry_date}
                                  onChange={(e) => updateItemField(index, 'expiry_date', e.target.value)}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  placeholder="Item notes"
                                  value={item.notes}
                                  onChange={(e) => updateItemField(index, 'notes', e.target.value)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Discrepancy Warning */}
                {receivingItems.some(item => item.quantity_received !== item.quantity_expected) && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-amber-900">Quantity Discrepancy Detected</h4>
                      <p className="text-sm text-amber-800 mt-1">
                        One or more items have different received quantities than expected.
                        Managers and the supplier will be automatically notified.
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
