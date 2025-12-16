import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer, PageHeader } from '@/components/layout';
import { useCurrency } from '@/hooks/useCurrency';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Upload, FileSpreadsheet, CheckCircle, Clock, AlertTriangle,
  Download, Search, Calculator, Truck, FileCheck
} from 'lucide-react';
import { format, isBefore } from 'date-fns';
import Papa from 'papaparse';

interface UploadedFile {
  id: string;
  courier_code: string;
  file_name: string;
  invoice_period_start: string;
  invoice_period_end: string;
  upload_date: string;
  status: string;
  total_records: number;
  matched_records: number;
  unmatched_records: number;
  total_amount: number;
}

interface ReconciliationRecord {
  id: string;
  tracking_id: string;
  order_number: string;
  courier_code: string;
  cod_amount: number;
  courier_charges: number;
  net_amount: number;
  payment_status: string;
  match_status: string;
  delivery_date: string;
  invoice_date: string;
}

const PaymentReconciliation = () => {
  const { currency } = useCurrency();
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('paid');
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    courier_code: '',
    invoice_period_start: '',
    invoice_period_end: ''
  });
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [fileName, setFileName] = useState('');

  // Fetch couriers
  const { data: couriers = [] } = useQuery({
    queryKey: ['couriers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch uploaded files
  const { data: uploadedFiles = [], isLoading: loadingFiles } = useQuery({
    queryKey: ['payment-uploads', selectedCourier],
    queryFn: async () => {
      let query = supabase
        .from('courier_payment_uploads')
        .select('*')
        .order('upload_date', { ascending: false });

      if (selectedCourier !== 'all') {
        query = query.eq('courier_code', selectedCourier);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as UploadedFile[];
    }
  });

  // Fetch reconciliation records
  const { data: reconciliationRecords = [], isLoading: loadingRecords } = useQuery({
    queryKey: ['reconciliation-records', selectedCourier, activeTab],
    queryFn: async () => {
      let query = supabase
        .from('payment_reconciliation_records')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (selectedCourier !== 'all') {
        query = query.eq('courier_code', selectedCourier);
      }

      // Filter by payment status based on active tab
      if (activeTab === 'paid') {
        query = query.eq('payment_status', 'paid');
      } else if (activeTab === 'pending') {
        query = query.eq('payment_status', 'pending');
      } else if (activeTab === 'not_eligible') {
        query = query.eq('payment_status', 'not_eligible');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReconciliationRecord[];
    }
  });

  // Fetch orders for expected payment calculation
  const { data: deliveredOrders = [] } = useQuery({
    queryKey: ['delivered-orders-reconciliation', selectedCourier],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, order_number, tracking_id, total_amount, shipping_charges, courier, status, delivered_at, dispatched_at')
        .in('status', ['delivered', 'dispatched', 'returned'])
        .order('delivered_at', { ascending: false })
        .limit(1000);

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by courier client-side
      if (selectedCourier !== 'all') {
        return (data || []).filter(o => o.courier === selectedCourier);
      }
      return data || [];
    }
  });

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results.data);
        toast({
          title: "File Parsed",
          description: `Found ${results.data.length} records in the file`
        });
      },
      error: (error) => {
        toast({
          title: "Parse Error",
          description: error.message,
          variant: "destructive"
        });
      }
    });
  };

  // Upload and process file
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadForm.courier_code || !uploadForm.invoice_period_start || !uploadForm.invoice_period_end) {
        throw new Error("Please fill all required fields");
      }
      if (parsedData.length === 0) {
        throw new Error("No data to upload");
      }

      // Create upload record
      const { data: upload, error: uploadError } = await supabase
        .from('courier_payment_uploads')
        .insert({
          courier_code: uploadForm.courier_code,
          file_name: fileName,
          invoice_period_start: uploadForm.invoice_period_start,
          invoice_period_end: uploadForm.invoice_period_end,
          uploaded_by: profile?.id,
          status: 'processing',
          total_records: parsedData.length,
          total_amount: parsedData.reduce((sum, row) => {
            const amount = parseFloat(row.cod_amount || row.COD || row.Amount || row.amount || '0');
            return sum + (isNaN(amount) ? 0 : amount);
          }, 0)
        })
        .select()
        .single();

      if (uploadError) throw uploadError;

      // Process each record and match with orders
      let matchedCount = 0;
      let unmatchedCount = 0;

      for (const row of parsedData) {
        const trackingId = row.tracking_id || row.TrackingID || row.tracking || row.Tracking || '';
        const codAmount = parseFloat(row.cod_amount || row.COD || row.Amount || row.amount || '0');
        const charges = parseFloat(row.charges || row.Charges || row.delivery_charges || '0');

        // Try to match with order
        const matchedOrder = deliveredOrders.find(o => 
          o.tracking_id === trackingId || o.order_number === trackingId
        );

        const matchStatus = matchedOrder ? 'matched' : 'unmatched';
        if (matchedOrder) matchedCount++;
        else unmatchedCount++;

        // Determine payment status based on invoice cycle
        let paymentStatus = 'pending';
        if (matchedOrder) {
          const deliveryDate = matchedOrder.delivered_at ? new Date(matchedOrder.delivered_at) : null;
          const invoiceEnd = new Date(uploadForm.invoice_period_end);
          
          if (matchedOrder.status === 'dispatched') {
            paymentStatus = 'not_eligible';
          } else if (deliveryDate && isBefore(deliveryDate, invoiceEnd)) {
            paymentStatus = 'paid';
          } else {
            paymentStatus = 'pending';
          }
        }

        await supabase
          .from('payment_reconciliation_records')
          .insert({
            upload_id: upload.id,
            order_id: matchedOrder?.id || null,
            tracking_id: trackingId,
            order_number: matchedOrder?.order_number || '',
            courier_code: uploadForm.courier_code,
            cod_amount: codAmount,
            courier_charges: charges,
            net_amount: codAmount - charges,
            payment_status: paymentStatus,
            match_status: matchStatus,
            delivery_date: matchedOrder?.delivered_at || null,
            invoice_date: uploadForm.invoice_period_end
          });
      }

      // Update upload record with counts
      await supabase
        .from('courier_payment_uploads')
        .update({
          status: 'completed',
          matched_records: matchedCount,
          unmatched_records: unmatchedCount
        })
        .eq('id', upload.id);

      return { matchedCount, unmatchedCount };
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Complete",
        description: `Matched: ${data.matchedCount}, Unmatched: ${data.unmatchedCount}`
      });
      setUploadDialogOpen(false);
      setParsedData([]);
      setFileName('');
      setUploadForm({ courier_code: '', invoice_period_start: '', invoice_period_end: '' });
      queryClient.invalidateQueries({ queryKey: ['payment-uploads'] });
      queryClient.invalidateQueries({ queryKey: ['reconciliation-records'] });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Calculate expected payment
  const expectedPayment = useMemo(() => {
    const delivered = deliveredOrders.filter(o => o.status === 'delivered');
    const inTransit = deliveredOrders.filter(o => o.status === 'dispatched');
    const returned = deliveredOrders.filter(o => o.status === 'returned');

    const deliveredCOD = delivered.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const deliveredCharges = delivered.reduce((sum, o) => sum + (Number(o.shipping_charges) || 0), 0);
    const returnCharges = returned.reduce((sum, o) => sum + (Number(o.shipping_charges) || 0), 0);

    const expectedAmount = deliveredCOD - deliveredCharges - returnCharges;

    // Sum of actual received from reconciliation
    const actualReceived = reconciliationRecords
      .filter(r => r.payment_status === 'paid')
      .reduce((sum, r) => sum + (Number(r.net_amount) || 0), 0);

    return {
      deliveredCount: delivered.length,
      inTransitCount: inTransit.length,
      returnedCount: returned.length,
      deliveredCOD,
      totalCharges: deliveredCharges + returnCharges,
      expectedAmount,
      actualReceived,
      difference: actualReceived - expectedAmount
    };
  }, [deliveredOrders, reconciliationRecords]);

  // Filter records by search
  const filteredRecords = useMemo(() => {
    if (!searchTerm) return reconciliationRecords;
    const term = searchTerm.toLowerCase();
    return reconciliationRecords.filter(r => 
      r.tracking_id?.toLowerCase().includes(term) ||
      r.order_number?.toLowerCase().includes(term)
    );
  }, [reconciliationRecords, searchTerm]);

  // Get status counts
  const statusCounts = useMemo(() => ({
    paid: reconciliationRecords.filter(r => r.payment_status === 'paid').length,
    pending: reconciliationRecords.filter(r => r.payment_status === 'pending').length,
    not_eligible: reconciliationRecords.filter(r => r.payment_status === 'not_eligible').length
  }), [reconciliationRecords]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Paid</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'not_eligible':
        return <Badge className="bg-blue-100 text-blue-800">In Transit</Badge>;
      case 'mismatch':
        return <Badge variant="destructive">Mismatch</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Payment Reconciliation"
        description="Match courier payments with delivered parcels"
        actions={
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Payment File
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Courier Payment File</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Courier</Label>
                  <Select 
                    value={uploadForm.courier_code} 
                    onValueChange={(v) => setUploadForm(prev => ({ ...prev, courier_code: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Courier" />
                    </SelectTrigger>
                    <SelectContent>
                      {couriers.map(c => (
                        <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Invoice Period Start</Label>
                    <Input 
                      type="date" 
                      value={uploadForm.invoice_period_start}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, invoice_period_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Invoice Period End</Label>
                    <Input 
                      type="date" 
                      value={uploadForm.invoice_period_end}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, invoice_period_end: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label>Payment File (CSV/Excel)</Label>
                  <Input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                  {fileName && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {fileName} - {parsedData.length} records
                    </p>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending || parsedData.length === 0}
                >
                  {uploadMutation.isPending ? 'Processing...' : 'Upload & Process'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by tracking ID or order number..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <Select value={selectedCourier} onValueChange={setSelectedCourier}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Couriers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Couriers</SelectItem>
                {couriers.map(c => (
                  <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Expected Payment Calculator */}
      <Card className="mb-6 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Expected Payment Calculator
          </CardTitle>
          <CardDescription>Compare expected vs actual payment received</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Delivered</p>
              <p className="text-xl font-bold text-green-600">{expectedPayment.deliveredCount}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">In Transit</p>
              <p className="text-xl font-bold text-blue-600">{expectedPayment.inTransitCount}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Returned</p>
              <p className="text-xl font-bold text-red-600">{expectedPayment.returnedCount}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">COD Collected</p>
              <p className="text-lg font-bold">{currency} {expectedPayment.deliveredCOD.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total Charges</p>
              <p className="text-lg font-bold text-red-600">{currency} {expectedPayment.totalCharges.toLocaleString()}</p>
            </div>
            <div className="text-center p-3 bg-green-100 dark:bg-green-950/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Expected Payment</p>
              <p className="text-lg font-bold text-green-600">{currency} {expectedPayment.expectedAmount.toLocaleString()}</p>
            </div>
            <div className={`text-center p-3 rounded-lg ${
              expectedPayment.difference >= 0 ? 'bg-green-100 dark:bg-green-950/30' : 'bg-red-100 dark:bg-red-950/30'
            }`}>
              <p className="text-xs text-muted-foreground">Difference</p>
              <p className={`text-lg font-bold ${expectedPayment.difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {expectedPayment.difference >= 0 ? '+' : ''}{currency} {expectedPayment.difference.toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Uploads */}
      {uploadedFiles.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Recent Uploads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {uploadedFiles.slice(0, 5).map(file => (
                <Card key={file.id} className="min-w-[250px] flex-shrink-0">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{file.courier_code}</Badge>
                      <Badge className={file.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {file.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(file.upload_date), 'MMM dd, yyyy')}
                    </p>
                    <div className="mt-2 text-xs">
                      <span className="text-green-600">Matched: {file.matched_records}</span>
                      {' | '}
                      <span className="text-red-600">Unmatched: {file.unmatched_records}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Reconciliation Records</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="paid" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Paid ({statusCounts.paid})
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-2">
                <Clock className="h-4 w-4" />
                Pending ({statusCounts.pending})
              </TabsTrigger>
              <TabsTrigger value="not_eligible" className="gap-2">
                <Truck className="h-4 w-4" />
                In Transit ({statusCounts.not_eligible})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              {loadingRecords ? (
                <div className="text-center py-8">Loading records...</div>
              ) : filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No records found. Upload a payment file to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tracking ID</TableHead>
                        <TableHead>Order #</TableHead>
                        <TableHead>Courier</TableHead>
                        <TableHead className="text-right">COD Amount</TableHead>
                        <TableHead className="text-right">Charges</TableHead>
                        <TableHead className="text-right">Net Amount</TableHead>
                        <TableHead>Match Status</TableHead>
                        <TableHead>Payment Status</TableHead>
                        <TableHead>Delivery Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map(record => (
                        <TableRow key={record.id}>
                          <TableCell className="font-mono text-sm">{record.tracking_id}</TableCell>
                          <TableCell>{record.order_number || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{record.courier_code}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{currency} {Number(record.cod_amount).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-red-600">{currency} {Number(record.courier_charges).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium">{currency} {Number(record.net_amount).toLocaleString()}</TableCell>
                          <TableCell>
                            {record.match_status === 'matched' ? (
                              <Badge className="bg-green-100 text-green-800">Matched</Badge>
                            ) : (
                              <Badge variant="destructive">Unmatched</Badge>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.payment_status)}</TableCell>
                          <TableCell>
                            {record.delivery_date ? format(new Date(record.delivery_date), 'MMM dd, yyyy') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default PaymentReconciliation;
