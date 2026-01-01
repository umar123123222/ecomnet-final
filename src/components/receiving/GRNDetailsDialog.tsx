import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useUserRoles } from '@/hooks/useUserRoles';
import { format } from 'date-fns';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Package, 
  ImageIcon,
  X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface GRNDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  grnId: string | null;
}

interface GRNItem {
  id: string;
  product_id: string | null;
  packaging_item_id: string | null;
  quantity_expected: number;
  quantity_received: number;
  quantity_accepted: number | null;
  quantity_rejected: number | null;
  quality_status: string;
  defect_type: string | null;
  notes: string | null;
  unit_cost: number;
  products?: { name: string; sku: string } | null;
  packaging_items?: { name: string; sku: string } | null;
}

interface ResolutionItem {
  item_id: string;
  quantity_accepted: number;
  quantity_rejected: number;
  quality_status: 'accepted' | 'rejected' | 'write_off';
  resolution_notes: string;
}

const GRNDetailsDialog: React.FC<GRNDetailsDialogProps> = ({ isOpen, onClose, grnId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasAnyRole } = useUserRoles();
  
  const canResolve = hasAnyRole(['super_admin', 'super_manager']);
  
  const [resolutions, setResolutions] = useState<Record<string, ResolutionItem>>({});
  const [overallNotes, setOverallNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fetch GRN details
  const { data: grn, isLoading } = useQuery({
    queryKey: ['grn-details', grnId],
    queryFn: async () => {
      if (!grnId) return null;
      const { data, error } = await supabase
        .from('goods_received_notes')
        .select(`
          *,
          suppliers(name),
          outlets(name),
          purchase_orders(po_number),
          receiver:profiles!goods_received_notes_received_by_fkey(full_name),
          inspector:profiles!goods_received_notes_inspected_by_fkey(full_name)
        `)
        .eq('id', grnId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!grnId && isOpen
  });

  // Fetch GRN items with PO item unit_price as fallback
  const { data: grnItems = [] } = useQuery({
    queryKey: ['grn-items', grnId],
    queryFn: async () => {
      if (!grnId) return [];
      const { data, error } = await supabase
        .from('grn_items')
        .select(`
          *,
          products(name, sku),
          packaging_items(name, sku),
          purchase_order_items:po_item_id(unit_price)
        `)
        .eq('grn_id', grnId);
      if (error) throw error;
      // Fallback: use PO unit_price if grn_item unit_cost is 0
      return (data || []).map((item: any) => ({
        ...item,
        unit_cost: item.unit_cost || item.purchase_order_items?.unit_price || 0
      })) as GRNItem[];
    },
    enabled: !!grnId && isOpen
  });

  // Initialize resolutions when items load
  React.useEffect(() => {
    if (grnItems.length > 0 && Object.keys(resolutions).length === 0) {
      const initialResolutions: Record<string, ResolutionItem> = {};
      grnItems.forEach(item => {
        initialResolutions[item.id] = {
          item_id: item.id,
          quantity_accepted: item.quantity_accepted ?? item.quantity_received,
          quantity_rejected: item.quantity_rejected ?? 0,
          quality_status: (item.quality_status as 'accepted' | 'rejected' | 'write_off') || 'accepted',
          resolution_notes: ''
        };
      });
      setResolutions(initialResolutions);
    }
  }, [grnItems]);

  // Resolve GRN mutation
  const resolveMutation = useMutation({
    mutationFn: async (action: 'accept' | 'reject' | 'resolve') => {
      // Validate rejection reason
      if (action === 'reject' && !rejectionReason.trim()) {
        throw new Error('Please provide a reason for rejection');
      }
      
      const { data, error } = await supabase.functions.invoke('process-grn', {
        body: {
          action,
          data: {
            grn_id: grnId,
            resolutions: Object.values(resolutions),
            notes: overallNotes,
            rejection_reason: action === 'reject' ? rejectionReason.trim() : undefined
          }
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['grns'] });
      queryClient.invalidateQueries({ queryKey: ['grn-details', grnId] });
      queryClient.invalidateQueries({ queryKey: ['pending-pos'] });
      toast({
        title: 'Success',
        description: action === 'accept' 
          ? 'GRN accepted and inventory updated' 
          : action === 'reject'
          ? 'GRN rejected'
          : 'Discrepancy resolved and inventory updated'
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const updateResolution = (itemId: string, field: keyof ResolutionItem, value: any) => {
    setResolutions(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value
      }
    }));
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, className?: string }> = {
      pending_inspection: { variant: 'secondary', label: 'Pending' },
      pending: { variant: 'secondary', label: 'Pending' },
      inspected: { variant: 'outline', label: 'Inspected' },
      accepted: { variant: 'default', label: 'Auto-Accepted', className: 'bg-green-500' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      resolved: { variant: 'default', label: 'Resolved' },
      partial_accept: { variant: 'outline', label: 'Partial Received', className: 'border-amber-500 text-amber-700' }
    };
    const config = variants[status] || variants.pending_inspection;
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  const getItemStatusIcon = (item: GRNItem) => {
    const hasDiscrepancy = item.quantity_received < item.quantity_expected;
    if (hasDiscrepancy) {
      return <AlertTriangle className="h-5 w-5 text-amber-600" />;
    }
    if (item.quality_status === 'accepted') {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (item.quality_status === 'rejected') {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
    return <Package className="h-5 w-5 text-muted-foreground" />;
  };

  // Allow rejection for pending, accepted, or partial_accept GRNs (to reverse if needed)
  const canRejectGRN = grn && ['pending_inspection', 'pending', 'accepted', 'partial_accept'].includes(grn.status);
  const isAutoProcessed = grn?.status === 'accepted' || grn?.status === 'partial_accept';
  const isRejected = grn?.status === 'rejected';

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={() => onClose()}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={() => onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Package className="h-6 w-6" />
              GRN Details - {grn?.grn_number}
            </DialogTitle>
          </DialogHeader>

          {grn && (
            <div className="space-y-6">
              {/* GRN Header Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(grn.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">PO Number</Label>
                  <p className="font-medium">{grn.purchase_orders?.po_number}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <p className="font-medium">{grn.suppliers?.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Outlet</Label>
                  <p className="font-medium">{grn.outlets?.name}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Received Date</Label>
                  <p className="font-medium">{format(new Date(grn.received_date || grn.created_at), 'MMM dd, yyyy')}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Received By</Label>
                  <p className="font-medium">{(grn.receiver as any)?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Expected Items</Label>
                  <p className="font-medium">{grn.total_items_expected}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Received Items</Label>
                  <p className={`font-medium ${grn.discrepancy_flag ? 'text-amber-600' : ''}`}>
                    {grn.total_items_received}
                    {grn.discrepancy_flag && <span className="ml-1">⚠️</span>}
                  </p>
                </div>
              </div>

              {/* Auto-Processed Info */}
              {isAutoProcessed && (
                <div className={`flex items-start gap-3 p-4 rounded-lg ${grn.status === 'accepted' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                  {grn.status === 'accepted' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-semibold">{grn.status === 'accepted' ? 'Auto-Accepted' : 'Partial Receiving'}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {grn.status === 'accepted' 
                        ? 'All items received as expected. Inventory has been updated automatically.'
                        : 'Some items were under-received. Inventory updated with received quantities. Supplier has been notified.'}
                    </p>
                    {canResolve && (
                      <p className="text-sm text-muted-foreground mt-2">
                        If there's an issue, you can reject this GRN to reverse the inventory update.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Rejected Info */}
              {isRejected && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900">Rejected</h4>
                    <p className="text-sm text-red-800 mt-1">
                      By {(grn.inspector as any)?.full_name || 'Manager'} on {grn.inspected_at ? format(new Date(grn.inspected_at), 'MMM dd, yyyy HH:mm') : 'N/A'}
                    </p>
                    {grn.rejection_reason && (
                      <p className="text-sm mt-2"><strong>Reason:</strong> {grn.rejection_reason}</p>
                    )}
                    <p className="text-sm text-red-700 mt-2">Inventory updates have been reversed.</p>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Items ({grnItems.length})</h3>
                
                {grnItems.map((item) => {
                  const hasItemDiscrepancy = item.quantity_received < item.quantity_expected;
                  const itemName = item.products?.name || item.packaging_items?.name || 'Unknown';
                  const itemSku = item.products?.sku || item.packaging_items?.sku || '';
                  const resolution = resolutions[item.id];
                  
                  return (
                    <Card 
                      key={item.id} 
                      className={hasItemDiscrepancy ? 'border-amber-300' : ''}
                    >
                      <CardContent className="pt-4 space-y-4">
                        {/* Item Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {getItemStatusIcon(item)}
                            <div>
                              <p className="font-medium">{itemName}</p>
                              <p className="text-sm text-muted-foreground">{itemSku}</p>
                              {item.packaging_item_id && (
                                <Badge variant="outline" className="mt-1">Packaging</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Unit Cost</p>
                            <p className="font-medium">Rs. {item.unit_cost.toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Quantities */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Expected</p>
                            <p className="text-xl font-bold">{item.quantity_expected}</p>
                          </div>
                          <div className={`p-3 rounded-lg ${hasItemDiscrepancy ? 'bg-amber-100' : 'bg-green-50'}`}>
                            <p className="text-xs text-muted-foreground">Received</p>
                            <p className="text-xl font-bold">{item.quantity_received}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground">Accepted</p>
                            <p className="text-xl font-bold">
                              {item.quantity_accepted ?? item.quantity_received}
                            </p>
                          </div>
                        </div>

                        {/* Discrepancy Info */}
                        {item.defect_type && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <p className="text-sm">
                              <span className="font-medium">Reason:</span> {item.defect_type.replace('_', ' ')}
                            </p>
                            {item.notes && (
                              <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                            )}
                          </div>
                        )}

                        {/* Resolution Controls removed - GRNs are now auto-processed */}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Rejection Notes - Show for managers on non-rejected GRNs */}
              {canResolve && canRejectGRN && (
                <div className="space-y-4 border-t pt-4">
                  <div>
                    <Label>Rejection Reason (required to reject)</Label>
                    <Textarea
                      placeholder="Enter reason for rejection - inventory will be reversed..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            
            {/* Reject button - available for super_admin/super_manager on non-rejected GRNs */}
            {canResolve && canRejectGRN && (
              <Button
                variant="destructive"
                onClick={() => resolveMutation.mutate('reject')}
                disabled={resolveMutation.isPending || !rejectionReason.trim()}
              >
                {resolveMutation.isPending ? 'Processing...' : 'Reject & Reverse Inventory'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Lightbox */}
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-3xl">
            <img src={selectedImage} alt="Damage proof" className="w-full rounded-lg" />
            <Button variant="outline" onClick={() => setSelectedImage(null)}>
              Close
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GRNDetailsDialog;
