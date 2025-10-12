import { useState } from 'react';
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
import { Search, Package, AlertTriangle, CheckCircle2, Camera } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

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
  const [selectedPO, setSelectedPO] = useState<string>('');

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
          suppliers(name),
          outlets(name)
        `)
        .in('status', ['sent', 'confirmed', 'partially_received'])
        .order('expected_delivery_date', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const startReceiving = (poId: string) => {
    setSelectedPO(poId);
    setIsReceivingDialogOpen(true);
  };

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
                  <div>
                    <p className="font-medium">{po.po_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {po.suppliers?.name} → {po.outlets?.name}
                    </p>
                  </div>
                  <Button onClick={() => startReceiving(po.id)}>
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

      {/* Receiving Dialog - Placeholder for detailed receiving flow */}
      <Dialog open={isReceivingDialogOpen} onOpenChange={setIsReceivingDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Goods - Line by Line Inspection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-center py-12 text-muted-foreground">
              <Camera className="mx-auto h-12 w-12 mb-4" />
              <p>Scan barcode or manually enter items to receive</p>
              <p className="text-sm mt-2">Full receiving workflow coming soon...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReceivingDashboard;
