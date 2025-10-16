
import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Search, Plus, Download, Scan, ChevronDown, ChevronUp } from 'lucide-react';
import { DatePickerWithRange } from '@/components/DatePickerWithRange';
import { DateRange } from 'react-day-picker';
import { addDays, isWithinInterval, parseISO } from 'date-fns';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import TagsNotes from '@/components/TagsNotes';
import UnifiedScanner, { ScanResult } from '@/components/UnifiedScanner';
import { useToast } from '@/hooks/use-toast';
import { logActivity, updateUserPerformance } from '@/utils/activityLogger';
import { useAuth } from '@/contexts/AuthContext';
import { useBulkOperations, BulkOperation } from '@/hooks/useBulkOperations';
import { BulkOperationsPanel } from '@/components/BulkOperationsPanel';
import { bulkReceiveReturns, bulkUpdateReturnStatus, exportToCSV } from '@/utils/bulkOperations';
import { CheckCircle, Package as PackageIcon } from 'lucide-react';

const manualEntrySchema = z.object({
  trackingIds: z.string().min(1, 'Please enter at least one tracking ID'),
});

const ReturnsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReturns, setSelectedReturns] = useState<string[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const { progress, executeBulkOperation } = useBulkOperations();

  const form = useForm<z.infer<typeof manualEntrySchema>>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      trackingIds: '',
    },
  });

  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('returns')
          .select(`
            *,
            orders!returns_order_id_fkey (
              order_number,
              customer_name,
              customer_phone
            )
          `)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching returns:', error);
          toast({
            title: "Error",
            description: "Failed to fetch returns",
            variant: "destructive",
          });
        } else {
          setReturns(data || []);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, [toast]);

  const filteredByDate = useMemo(() => {
    if (!dateRange?.from) return returns;
    
    return returns.filter(returnItem => {
      const returnDate = parseISO(returnItem.date);
      if (dateRange.to) {
        return isWithinInterval(returnDate, { start: dateRange.from, end: dateRange.to });
      }
      return returnDate >= dateRange.from;
    });
  }, [returns, dateRange]);

  const filteredReturns = useMemo(() => {
    return filteredByDate.filter(returnItem => 
      (returnItem.tracking_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.orders?.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (returnItem.orders?.order_number || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [filteredByDate, searchTerm]);

  const metrics = useMemo(() => {
    const returnedCount = filteredByDate.length;
    const returnedWorth = filteredByDate.reduce((sum, returnItem) => {
      return sum + (returnItem.worth || 0);
    }, 0);

    return {
      returnedCount,
      returnedWorth: `PKR ${returnedWorth.toLocaleString()}`,
    };
  }, [filteredByDate]);

  const handleSelectReturn = (returnId: string) => {
    setSelectedReturns(prev => 
      prev.includes(returnId) 
        ? prev.filter(id => id !== returnId)
        : [...prev, returnId]
    );
  };

  const handleSelectAll = () => {
    setSelectedReturns(
      selectedReturns.length === filteredReturns.length 
        ? [] 
        : filteredReturns.map(r => r.id)
    );
  };

  const handleScanComplete = async (result: ScanResult) => {
    console.log(`Scanned return via ${result.method} in ${result.scanDuration}ms`);
    
    try {
      const { trackingId, orderId } = result;
      
      // Match scanned data with returns in database
      let query = supabase.from('returns').select(`
        *,
        orders:order_id (
          order_number,
          customer_name,
          customer_phone
        )
      `);

      if (trackingId) {
        query = query.eq('tracking_id', trackingId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      }

      const { data: matchedReturns, error } = await query;

      if (error) throw error;

      if (matchedReturns && matchedReturns.length > 0) {
        const returnItem = matchedReturns[0];
        
        toast({
          title: 'Return Found',
          description: `Order: ${returnItem.orders?.order_number || orderId}`,
        });

        // Update performance metrics
        if (user?.id) {
          await updateUserPerformance(user.id, 'returns_handled', 1);
        }

        // Log activity
        await logActivity({
          action: 'return_received',
          entityType: 'return',
          entityId: returnItem.id,
          details: { 
            scannedAt: new Date().toISOString(),
            trackingId: returnItem.tracking_id,
            scanMethod: result.method,
          },
        });

        // Refresh returns list
        const { data: updatedReturns } = await supabase
          .from('returns')
          .select(`
            *,
            orders:order_id (
              order_number,
              customer_name,
              customer_phone
            )
          `)
          .order('created_at', { ascending: false });

        if (updatedReturns) {
          setReturns(updatedReturns);
        }
      } else {
        toast({
          title: 'Return Not Found',
          description: `No return found with ID: ${trackingId || orderId}`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing scanned return:', error);
      toast({
        title: 'Error',
        description: 'Failed to process scanned return',
        variant: 'destructive',
      });
    } finally {
      setIsScanDialogOpen(false);
    }
  };

  const toggleRowExpansion = (returnId: string) => {
    setExpandedRows(prev => 
      prev.includes(returnId) 
        ? prev.filter(id => id !== returnId)
        : [...prev, returnId]
    );
  };

  const onManualEntrySubmit = (values: z.infer<typeof manualEntrySchema>) => {
    // Manual entry tracking IDs processed
    setIsManualEntryOpen(false);
    form.reset();
  };

  // Bulk operations
  const bulkOperations: BulkOperation[] = [
    {
      id: 'receive',
      label: 'Mark as Received',
      icon: CheckCircle,
      action: async (ids) => {
        if (!user?.id) {
          return { success: 0, failed: ids.length, errors: ['User not authenticated'] };
        }
        return bulkReceiveReturns(ids, user.id);
      },
    },
    {
      id: 'processed',
      label: 'Mark as Processed',
      icon: PackageIcon,
      action: async (ids) => bulkUpdateReturnStatus(ids, 'processed'),
    },
    {
      id: 'export',
      label: 'Export Selected',
      icon: Download,
      action: async (ids) => {
        const selectedReturns = returns.filter(r => ids.includes(r.id));
        exportToCSV(selectedReturns, `returns-${new Date().toISOString().split('T')[0]}`);
        return { success: ids.length, failed: 0 };
      },
    },
  ];

  const handleBulkOperation = (operation: BulkOperation) => {
    executeBulkOperation(operation, selectedReturns, () => {
      // Refresh returns list after operation
      const fetchReturns = async () => {
        const { data } = await supabase
          .from('returns')
          .select(`
            *,
            orders:order_id (
              order_number,
              customer_name,
              customer_phone
            )
          `)
          .order('created_at', { ascending: false });
        if (data) setReturns(data);
      };
      fetchReturns();
      setSelectedReturns([]);
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Returns Management</h1>
          <p className="text-gray-600 mt-1">Track and manage returned orders</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setIsScanDialogOpen(true)}>
            <Scan className="h-4 w-4 mr-2" />
            Scan Return
          </Button>

          <Dialog open={isManualEntryOpen} onOpenChange={setIsManualEntryOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Manual Entry
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manual Entry</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onManualEntrySubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="trackingIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tracking ID(s)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Enter tracking ID(s) separated by commas"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsManualEntryOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Submit</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Unified Scanner */}
      <UnifiedScanner
        isOpen={isScanDialogOpen}
        onClose={() => setIsScanDialogOpen(false)}
        onScan={handleScanComplete}
        scanType="return"
        title="Scan Return Package"
      />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Returned Orders (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.returnedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Worth of Returns (Selected Period)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.returnedWorth}</div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Operations */}
      <BulkOperationsPanel
        selectedCount={selectedReturns.length}
        operations={bulkOperations}
        onExecute={handleBulkOperation}
        progress={progress}
      />

      {/* Returns Table with integrated filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Returns ({filteredReturns.length})</span>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedReturns.length === filteredReturns.length && filteredReturns.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by tracking ID, customer, order ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DatePickerWithRange
              date={dateRange}
              setDate={setDateRange}
              className="w-full"
            />
            <Button variant="outline" disabled={selectedReturns.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Download Selected
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Select</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Tracking ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Worth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : filteredReturns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center">No returns found</TableCell>
                </TableRow>
              ) : (
                filteredReturns.map((returnItem) => (
                  <React.Fragment key={returnItem.id}>
                    <TableRow>
                      <TableCell>
                        <Checkbox
                          checked={selectedReturns.includes(returnItem.id)}
                          onCheckedChange={() => handleSelectReturn(returnItem.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{returnItem.orders?.order_number || 'N/A'}</TableCell>
                      <TableCell>{returnItem.tracking_id || 'N/A'}</TableCell>
                      <TableCell>{returnItem.orders?.customer_name || 'N/A'}</TableCell>
                      <TableCell>{returnItem.orders?.customer_phone || 'N/A'}</TableCell>
                      <TableCell>{returnItem.reason || 'N/A'}</TableCell>
                      <TableCell>PKR {(returnItem.worth || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge className={returnItem.return_status === 'received' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {returnItem.return_status || 'in_transit'}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(returnItem.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(returnItem.id)}
                        >
                          {expandedRows.includes(returnItem.id) ? 
                            <ChevronUp className="h-4 w-4" /> : 
                            <ChevronDown className="h-4 w-4" />
                          }
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedRows.includes(returnItem.id) && (
                      <TableRow>
                        <TableCell colSpan={10} className="bg-gray-50 p-4">
                          <div className="space-y-2">
                            <p><strong>Notes:</strong> {returnItem.notes || 'No notes available'}</p>
                            <p><strong>Received Date:</strong> {returnItem.received_at ? new Date(returnItem.received_at).toLocaleDateString() : 'Not received yet'}</p>
                            <p><strong>Tags:</strong> {returnItem.tags ? returnItem.tags.join(', ') : 'No tags'}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReturnsDashboard;
